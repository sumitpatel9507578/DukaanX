ALTER TABLE sale_items
  ADD CONSTRAINT fk_sale_items_batch
  FOREIGN KEY (batch_id) REFERENCES stock_batches(id);
