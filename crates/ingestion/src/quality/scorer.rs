use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityWeights {
    pub has_description: f32,
    pub has_poster: f32,
    pub has_backdrop: f32,
    pub has_release_year: f32,
    pub has_runtime: f32,
    pub has_genres: f32,
    pub has_imdb_rating: f32,
    pub has_external_ids: f32,
    pub freshness_weight: f32,
}

impl Default for QualityWeights {
    fn default() -> Self {
        Self {
            has_description: 0.15,
            has_poster: 0.15,
            has_backdrop: 0.10,
            has_release_year: 0.05,
            has_runtime: 0.05,
            has_genres: 0.10,
            has_imdb_rating: 0.15,
            has_external_ids: 0.10,
            freshness_weight: 0.15,
        }
    }
}

#[derive(Debug, Clone)]
pub struct QualityScorer {
    pub weights: QualityWeights,
}

impl Default for QualityScorer {
    fn default() -> Self {
        Self {
            weights: QualityWeights::default(),
        }
    }
}

impl QualityScorer {
    pub fn new(weights: QualityWeights) -> Self {
        Self { weights }
    }

    /// Score content based on metadata completeness and quality dimensions
    ///
    /// Returns a score from 0.0 to 1.0 based on:
    /// - metadata_completeness: description, poster, runtime
    /// - image_quality: high-res images, multiple images
    /// - external_ratings: IMDB, Rotten Tomatoes ratings
    ///
    /// Note: This is a wrapper around canonical_adapter functions for
    /// backwards compatibility. For new code, use canonical_adapter directly.
    pub fn score_content(&self, content: &crate::normalizer::CanonicalContent) -> f32 {
        super::canonical_adapter::score_canonical_content(content, &self.weights)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LowQualityItem {
    pub id: String,
    pub title: String,
    pub quality_score: f32,
    pub missing_fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreDistribution {
    pub range: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissingFieldsSummary {
    pub field: String,
    pub missing_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityReport {
    pub total_content: u64,
    pub average_score: f32,
    pub score_distribution: Vec<ScoreDistribution>,
    pub low_quality_content: Vec<LowQualityItem>,
    pub missing_fields_summary: Vec<MissingFieldsSummary>,
}

impl QualityReport {
    pub fn new() -> Self {
        Self {
            total_content: 0,
            average_score: 0.0,
            score_distribution: vec![],
            low_quality_content: vec![],
            missing_fields_summary: vec![],
        }
    }

}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_weights() {
        let weights = QualityWeights::default();
        assert_eq!(weights.has_description, 0.15);
        assert_eq!(weights.has_poster, 0.15);
        assert_eq!(weights.freshness_weight, 0.15);
    }

    #[test]
    fn test_custom_weights() {
        let weights = QualityWeights {
            has_description: 0.5,
            has_poster: 0.5,
            has_backdrop: 0.0,
            has_release_year: 0.0,
            has_runtime: 0.0,
            has_genres: 0.0,
            has_imdb_rating: 0.0,
            has_external_ids: 0.0,
            freshness_weight: 0.0,
        };

        let scorer = QualityScorer::new(weights);
        assert_eq!(scorer.weights.has_description, 0.5);
        assert_eq!(scorer.weights.has_poster, 0.5);
    }

    #[test]
    fn test_quality_report_new() {
        let report = QualityReport::new();
        assert_eq!(report.total_content, 0);
        assert_eq!(report.average_score, 0.0);
        assert_eq!(report.low_quality_content.len(), 0);
    }
}
