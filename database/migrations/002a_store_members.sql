CREATE TABLE IF NOT EXISTS store_members (
  store_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('owner', 'manager', 'staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id, user_id),
  CONSTRAINT fk_store_members_store FOREIGN KEY (store_id) REFERENCES stores(id),
  CONSTRAINT fk_store_members_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
