CREATE TABLE IF NOT EXISTS stock_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  batch_id BIGINT UNSIGNED NULL,
  type VARCHAR(32) NOT NULL,
  quantity_change DECIMAL(14,3) NOT NULL,
  reference_type VARCHAR(32) NULL,
  reference_id BIGINT UNSIGNED NULL,
  reason VARCHAR(100) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stock_tx_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_stock_tx_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_stock_tx_batch FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
  CONSTRAINT fk_stock_tx_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_stock_tx_store_date (store_id, created_at),
  INDEX idx_stock_tx_product_date (product_id, created_at)
) ENGINE=InnoDB;
