CREATE TABLE IF NOT EXISTS supplier_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(24) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  reference_type VARCHAR(32) NULL,
  reference_id BIGINT UNSIGNED NULL,
  description VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_supplier_tx_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_supplier_tx_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_supplier_tx_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_supplier_tx_ledger (store_id, supplier_id, created_at)
) ENGINE=InnoDB;
