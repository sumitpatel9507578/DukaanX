CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id BIGINT UNSIGNED NOT NULL,
  party_type ENUM('customer', 'supplier') NOT NULL,
  party_id BIGINT UNSIGNED NULL,
  amount DECIMAL(14,2) NOT NULL,
  method ENUM('cash', 'upi', 'card', 'bank_transfer', 'credit', 'mixed') NOT NULL,
  direction ENUM('received', 'paid', 'refund') NOT NULL,
  reference VARCHAR(120) NULL,
  notes VARCHAR(500) NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_payments_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_payments_party (store_id, party_type, party_id, created_at)
) ENGINE=InnoDB;
