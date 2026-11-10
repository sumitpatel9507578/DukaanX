ALTER TABLE purchase_items
  ADD CONSTRAINT fk_purchase_items_batch
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id);
