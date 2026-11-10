INSERT INTO categories (store_id, name, description)
SELECT NULL, seed.name, seed.description
FROM (
  SELECT 'Grocery' AS name, 'Staple food and pantry items' AS description
  UNION ALL SELECT 'Beverages', 'Drinks and beverages'
  UNION ALL SELECT 'Dairy', 'Milk and dairy products'
  UNION ALL SELECT 'Household', 'Household essentials'
) AS seed
WHERE NOT EXISTS (
  SELECT 1 FROM categories existing WHERE existing.store_id IS NULL AND existing.name = seed.name
);
