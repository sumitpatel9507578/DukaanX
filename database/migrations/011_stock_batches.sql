CREATE TABLE IF NOT EXISTS stock_batches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  batch_number VARCHAR(100) NULL,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  purchase_price DECIMAL(14,2) NOT NULL,
  manufacturing_date DATE NULL,
  expiry_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_batches_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products(id),
  INDEX idx_batches_fefo (store_id, product_id, expiry_date, id),
  INDEX idx_batches_expiry (store_id, expiry_date)
) ENGINE=InnoDB;
