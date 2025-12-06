use crate::{
    error::{AuthError, Result},
    password_reset::{ForgotPasswordRequest, ForgotPasswordResponse, PasswordResetToken, ResetPasswordRequest, ResetPasswordResponse, PasswordValidator},
    storage::AuthStorage,
    user::{PasswordHasher, PostgresUserRepository, UserRepository},
};
use actix_web::{post, web::{self, Data}, HttpResponse, Responder};
use std::sync::Arc;
use uuid::Uuid;

pub struct AppState {
    pub storage: Arc<AuthStorage>,
}

#[post("/api/v1/auth/password/forgot")]
pub async fn forgot_password(
    req: web::Json<ForgotPasswordRequest>,
    state: Data<AppState>,
    db_pool: Data<sqlx::PgPool>,
) -> Result<impl Responder> {
    let user_repo = PostgresUserRepository::new(db_pool.get_ref().clone());

    // Check rate limit
    let remaining = state.storage.check_password_reset_rate_limit(&req.email).await?;
    if remaining == 0 {
        // Return success even when rate limited to prevent enumeration
        return Ok(HttpResponse::Ok().json(ForgotPasswordResponse {
            message: "If an account exists with this email, a password reset link has been sent.".to_string(),
        }));
    }

    // Find user by email
    let user = user_repo.find_by_email(&req.email).await?;

    // Always return success to prevent email enumeration
    if let Some(user) = user {
        // Generate reset token
        let reset_token = PasswordResetToken::new(user.id.to_string(), user.email.clone());

        // Store token in Redis
        state.storage.store_password_reset_token(&reset_token.token, &reset_token).await?;

        // TODO: Send password reset email
        tracing::info!("Password reset requested for user: {}", user.email);
        tracing::debug!("Reset token: {}", reset_token.token);
    }

    Ok(HttpResponse::Ok().json(ForgotPasswordResponse {
        message: "If an account exists with this email, a password reset link has been sent.".to_string(),
    }))
}

#[post("/api/v1/auth/password/reset")]
pub async fn reset_password(
    req: web::Json<ResetPasswordRequest>,
    state: Data<AppState>,
    db_pool: Data<sqlx::PgPool>,
) -> Result<impl Responder> {
    // Validate new password
    PasswordValidator::validate(&req.new_password)?;

    // Get reset token from Redis
    let reset_token = state.storage.get_password_reset_token(&req.token).await?
        .ok_or(AuthError::InvalidToken("Invalid or expired reset token".to_string()))?;

    // Check if token is expired
    if reset_token.is_expired() {
        state.storage.delete_password_reset_token(&req.token).await?;
        return Err(AuthError::InvalidToken("Reset token expired".to_string()));
    }

    let user_repo = PostgresUserRepository::new(db_pool.get_ref().clone());

    // Parse user_id
    let user_id = Uuid::parse_str(&reset_token.user_id)
        .map_err(|e| AuthError::Internal(format!("Invalid user ID: {}", e)))?;

    // Hash new password
    let new_password_hash = PasswordHasher::hash_password(&req.new_password)?;

    // Update password in database
    user_repo.update_password(user_id, &new_password_hash).await?;

    // Delete reset token (single-use)
    state.storage.delete_password_reset_token(&req.token).await?;

    // Invalidate all existing sessions for this user
    state.storage.delete_user_sessions(&reset_token.user_id).await?;

    // TODO: Send "password changed" notification email
    tracing::info!("Password reset successful for user: {}", reset_token.email);

    Ok(HttpResponse::Ok().json(ResetPasswordResponse {
        message: "Password has been reset successfully. All sessions have been invalidated.".to_string(),
    }))
}
