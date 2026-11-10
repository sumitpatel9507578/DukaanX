CREATE TABLE IF NOT EXISTS customer_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(24) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference_type VARCHAR(32) NULL,
  reference_id BIGINT UNSIGNED NULL,
  description VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customer_tx_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_customer_tx_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_customer_tx_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_customer_tx_ledger (store_id, customer_id, created_at)
) ENGINE=InnoDB;
