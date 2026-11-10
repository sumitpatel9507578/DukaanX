CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_activity_store_date (store_id, created_at)
) ENGINE=InnoDB;
