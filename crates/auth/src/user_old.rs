use crate::error::{AuthError, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher as _, PasswordVerifier, SaltString},
    Argon2,
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: Option<String>,
    pub display_name: Option<String>,
    pub email_verified: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub email: String,
    pub password: String,
    pub username: Option<String>,
    pub email_verified: bool,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub display_name: Option<String>,
}

pub struct PasswordHasher;

impl PasswordHasher {
    pub fn hash_password(password: &str) -> Result<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AuthError::Internal(format!("Password hashing failed: {}", e)))?;
        Ok(hash.to_string())
    }

    pub fn verify_password(password: &str, hash: &str) -> Result<bool> {
        let parsed_hash = PasswordHash::new(hash)
            .map_err(|e| AuthError::Internal(format!("Invalid password hash: {}", e)))?;
        let argon2 = Argon2::default();
        Ok(argon2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
    }
}

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_email(&self, email: &str) -> Result<Option<User>>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>>;
    async fn update_password(&self, user_id: Uuid, new_password_hash: &str) -> Result<()>;
    async fn create_user(&self, req: CreateUserRequest) -> Result<User>;
    async fn mark_email_verified(&self, user_id: Uuid) -> Result<()>;
    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>>;
    async fn verify_password(&self, email: &str, password: &str) -> Result<User>;
}

pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create_user(&self, req: CreateUserRequest) -> Result<User> {
        let password_hash = PasswordHasher::hash_password(&req.password)?;
        let user_id = Uuid::new_v4();

        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (id, email, password_hash, display_name, email_verified)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, password_hash, display_name, email_verified, created_at
            "#
        )
        .bind(user_id)
        .bind(&req.email)
        .bind(&password_hash)
        .bind(&req.username)
        .bind(req.email_verified)
        .fetch_one(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn mark_email_verified(&self, user_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET email_verified = true
            WHERE id = $1
            "#
        )
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_user_by_email(&self, email: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, password_hash, display_name, email_verified, created_at
            FROM users
            WHERE email = $1
            "#
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    pub async fn verify_password(&self, email: &str, password: &str) -> Result<User> {
        let user = self.get_user_by_email(email).await?
            .ok_or(AuthError::InvalidCredentials)?;

        let password_hash = user.password_hash.as_ref()
            .ok_or(AuthError::InvalidCredentials)?;

        if !PasswordHasher::verify_password(password, password_hash)? {
            return Err(AuthError::InvalidCredentials);
        }

        Ok(user)
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn find_by_email(&self, email: &str) -> Result<Option<User>> {
        self.get_user_by_email(email).await
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT id, email, password_hash, display_name, email_verified, created_at
            FROM users
            WHERE id = $1
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn update_password(&self, user_id: Uuid, new_password_hash: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET password_hash = $1
            WHERE id = $2
            "#
        )
        .bind(new_password_hash)
        .bind(user_id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn create_user(&self, req: CreateUserRequest) -> Result<User> {
        self.create_user(req).await
    }

    async fn mark_email_verified(&self, user_id: Uuid) -> Result<()> {
        self.mark_email_verified(user_id).await
    }

    async fn get_user_by_email(&self, email: &str) -> Result<Option<User>> {
        self.get_user_by_email(email).await
    }

    async fn verify_password(&self, email: &str, password: &str) -> Result<User> {
        self.verify_password(email, password).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hashing() {
        let password = "test_password_123";
        let hash = PasswordHasher::hash_password(password).unwrap();

        assert_ne!(hash, password);
        assert!(PasswordHasher::verify_password(password, &hash).unwrap());
        assert!(!PasswordHasher::verify_password("wrong_password", &hash).unwrap());
    }

    #[test]
    fn test_password_hash_uniqueness() {
        let password = "same_password";
        let hash1 = PasswordHasher::hash_password(password).unwrap();
        let hash2 = PasswordHasher::hash_password(password).unwrap();

        // Hashes should be different due to random salt
        assert_ne!(hash1, hash2);

        // Both should verify correctly
        assert!(PasswordHasher::verify_password(password, &hash1).unwrap());
        assert!(PasswordHasher::verify_password(password, &hash2).unwrap());
    }
}
