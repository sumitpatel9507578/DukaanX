# DukaanX API

Base URL: `http://localhost:5000`

All responses use JSON:

```json
{ "success": true, "message": "Operation successful", "data": {} }
```

Errors use `{ "success": false, "message": "...", "error": null }`. Common
statuses are `400` invalid input, `401` missing/invalid JWT, `404` missing or
inaccessible resource, `409` conflict or insufficient stock, `500` unexpected
server error, and `503` unavailable external configuration. Production errors
do not expose SQL or stack traces.

Protected examples use:

```http
Authorization: Bearer <jwt>
X-Store-Id: 5
Content-Type: application/json
```

The JWT identifies the user; the backend checks membership in the active store
identified by `X-Store-Id`. Store-management endpoints require a JWT but do not
require `X-Store-Id`. List endpoints accept `?page=1&limit=20` (limit capped at 100) and return `{items, pagination:{page,limit,total,pages}}`.

## Auth (1–6)

1. **POST `/api/auth/register`** — Public. Body: `{name,email,password,phone?}`; password must be at least 8 characters. Example: `{"name":"Asha","email":"asha@example.com","password":"long-password"}`. Success `201`: `{user:{id,name,email},token}`. Errors: `400` invalid fields, `409` email exists. Response example: `{"success":true,"message":"Account registered successfully","data":{"user":{"id":1,"name":"Asha","email":"asha@example.com"},"token":"<jwt>"}}`.
2. **POST `/api/auth/login`** — Public. Body: `{email,password}`. Example: `{"email":"asha@example.com","password":"long-password"}`. Success: `{user:{id,name,email},token}`. Errors: `400` missing fields, `401` invalid credentials. Response example: `{"success":true,"message":"Login successful","data":{"user":{"id":1,"name":"Asha","email":"asha@example.com"},"token":"<jwt>"}}`.
3. **POST `/api/auth/forgot-password`** — Public. Body: `{email}`. Example: `{"email":"asha@example.com"}`. Success: generic confirmation (does not reveal account existence); a random, one-hour token is stored as a hash and emailed using SMTP. Errors: `400` missing email, `503` SMTP not configured, `500` delivery failure. Response example: `{"success":true,"message":"If the account exists, password reset instructions have been sent","data":null}`.
4. **POST `/api/auth/reset-password`** — Public. Body: `{token,password}`; token is single-use and expires after one hour. Example: `{"token":"<email-token>","password":"new-long-password"}`. Success: `data:null`. Errors: `400` invalid/expired token or short password. Response example: `{"success":true,"message":"Password reset successfully","data":null}`.
5. **GET `/api/auth/me`** — JWT. No parameters/body. Success: public profile fields only. Errors: `401`. Example request: `GET /api/auth/me`. Response example: `{"success":true,"message":"Profile loaded","data":{"id":1,"name":"Asha","email":"asha@example.com","phone":null}}`.
6. **PUT `/api/auth/profile`** — JWT. Body: optional `name`, `phone` (at least one). Example: `{"name":"Asha Patel","phone":"9999999999"}`. Success: updated profile; errors: `400`, `401`. Response example: `{"success":true,"message":"Profile updated","data":{"id":1,"name":"Asha Patel","email":"asha@example.com","phone":"9999999999"}}`.

## Stores (7–11)

7. **POST `/api/stores`** — JWT. Body: `{name,phone?,email?,address?,image?}`; image may be a URL or multipart image. Example: `{"name":"Corner Shop","address":"Main Road"}`. Success `201`: store and owner membership; errors: `400`, `401`. Response example: `{"success":true,"message":"stores created","data":{"id":5,"name":"Corner Shop","owner_user_id":1}}`.
8. **GET `/api/stores`** — JWT. Query: pagination and optional `search`. No body. Success: user's active stores with pagination; errors: `401`. Example: `GET /api/stores?page=1&limit=20`. Response example: `{"success":true,"message":"stores listed","data":{"items":[{"id":5,"name":"Corner Shop"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
9. **GET `/api/stores/:id`** — JWT. Path: store id. Success: store accessible to the user; errors: `401`, `404`. Example: `GET /api/stores/5`. Response example: `{"success":true,"message":"stores details","data":{"id":5,"name":"Corner Shop"}}`.
10. **PUT `/api/stores/:id`** — JWT; owner/manager role. Body: any supplied store fields from create. Example: `{"name":"Corner Shop 2"}`. Success: updated store; errors: `401`, `404`. Response example: `{"success":true,"message":"stores updated","data":{"id":5,"name":"Corner Shop 2"}}`.
11. **DELETE `/api/stores/:id`** — JWT; store owner. Soft-deactivates the store. Example: `DELETE /api/stores/5`. Success: `data:null`; errors: `401`, `404`. Response example: `{"success":true,"message":"stores deactivated","data":null}`.

## Categories (12–16)

All endpoints require JWT and `X-Store-Id`.

12. **POST `/api/categories`** — Body: `{name,description?}`. Example: `{"name":"Dairy"}`. Success `201`: category. Errors: `400`, `401`, `404` store. Response example: `{"success":true,"message":"categories created","data":{"id":2,"store_id":5,"name":"Dairy"}}`.
13. **GET `/api/categories`** — Query: pagination, `search`, `is_active`. Returns store categories plus shared seeded categories. Example: `GET /api/categories?page=1&limit=20`. Success: paginated items; errors: `401`, `404`. Response example: `{"success":true,"message":"categories listed","data":{"items":[{"id":2,"name":"Dairy"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
14. **GET `/api/categories/:id`** — Path: category id. Example: `GET /api/categories/2`. Success: category; errors: `401`, `404`. Response example: `{"success":true,"message":"categories details","data":{"id":2,"name":"Dairy"}}`.
15. **PUT `/api/categories/:id`** — Body: `{name?,description?}`. Example: `{"name":"Dairy and Eggs"}`. Success: updated category; errors: `400`, `401`, `404`. Response example: `{"success":true,"message":"categories updated","data":{"id":2,"name":"Dairy and Eggs"}}`.
16. **DELETE `/api/categories/:id`** — Soft-deactivates a store category. Example: `DELETE /api/categories/2`. Success: `data:null`; errors: `401`, `404`. Response example: `{"success":true,"message":"categories deactivated","data":null}`.

## Products (17–22)

All endpoints require JWT and `X-Store-Id`. Product fields: `name`,
`category_id`, `brand`, `barcode`, `sku`, `unit`, `purchase_price`,
`selling_price`, `minimum_stock`, `image`, `description`, `is_active`. Prices
and minimum stock cannot be negative. Image uploads accept JPEG, PNG, or WebP
up to 5 MB when Cloudinary is configured.

17. **POST `/api/products`** — Body: product fields; `name` required. Example: `{"name":"Milk 1L","selling_price":60,"purchase_price":48,"minimum_stock":5}`. Success `201`: product. Errors: `400`, `401`, `404` invalid category, `409` duplicate SKU/barcode. Response example: `{"success":true,"message":"products created","data":{"id":10,"name":"Milk 1L","store_id":5}}`.
18. **GET `/api/products`** — Query: `search`, `category_id`, `barcode`, `is_active`, pagination. Example: `GET /api/products?search=milk&category_id=2&page=1&limit=20`. Success: paginated products; errors: `401`. Response example: `{"success":true,"message":"products listed","data":{"items":[{"id":10,"name":"Milk 1L"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
19. **GET `/api/products/:id`** — Path: product id. Returns product, calculated stock, and batches. Example: `GET /api/products/10`. Errors: `401`, `404`. Response example: `{"success":true,"message":"Product details","data":{"id":10,"name":"Milk 1L","stock_quantity":5,"batches":[]}}`.
20. **PUT `/api/products/:id`** — Body: any product fields. Example: `{"selling_price":62}`. Success: updated product; errors: `400`, `401`, `404`, `409` duplicate identifier. Response example: `{"success":true,"message":"products updated","data":{"id":10,"selling_price":62}}`.
21. **DELETE `/api/products/:id`** — Soft-deactivates product. Example: `DELETE /api/products/10`. Success: `data:null`; errors: `401`, `404`. Response example: `{"success":true,"message":"products deactivated","data":null}`.
22. **GET `/api/products/barcode/:barcode`** — Path: barcode. Example: `GET /api/products/barcode/123456`. Success: matching active product; errors: `401`, `404`. Response example: `{"success":true,"message":"Product found","data":{"id":10,"barcode":"123456","name":"Milk 1L"}}`.

## Suppliers (23–27)

All endpoints require JWT and `X-Store-Id`.

23. **POST `/api/suppliers`** — Body: `{name,phone?,email?,address?}`. Example: `{"name":"Fresh Foods Ltd","phone":"9999999999"}`. Success `201`; errors: `400`, `401`. Response example: `{"success":true,"message":"suppliers created","data":{"id":3,"name":"Fresh Foods Ltd"}}`.
24. **GET `/api/suppliers`** — Query: `search`, `is_active`, pagination. Example: `GET /api/suppliers?search=fresh&page=1`. Success: paginated suppliers; errors: `401`. Response example: `{"success":true,"message":"suppliers listed","data":{"items":[{"id":3,"name":"Fresh Foods Ltd"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
25. **GET `/api/suppliers/:id`** — Path: supplier id. Example: `GET /api/suppliers/3`. Errors: `401`, `404`. Response example: `{"success":true,"message":"suppliers details","data":{"id":3,"name":"Fresh Foods Ltd"}}`.
26. **PUT `/api/suppliers/:id`** — Body: supplied supplier fields. Example: `{"phone":"8888888888"}`. Errors: `400`, `401`, `404`. Response example: `{"success":true,"message":"suppliers updated","data":{"id":3,"phone":"8888888888"}}`.
27. **DELETE `/api/suppliers/:id`** — Soft-deactivates supplier. Example: `DELETE /api/suppliers/3`. Errors: `401`, `404`. Response example: `{"success":true,"message":"suppliers deactivated","data":null}`.

## Customers and Khata (28–33)

All endpoints require JWT and `X-Store-Id`. Ledger balance is opening balance
plus signed customer transactions: debit increases amount due; credit/payment
or return decreases it.

28. **POST `/api/customers`** — Body: `{name,phone?,email?,address?}`. Example: `{"name":"Rahul Kumar","phone":"9999999999"}`. Success `201`; errors: `400`, `401`. Response example: `{"success":true,"message":"customers created","data":{"id":4,"name":"Rahul Kumar"}}`.
29. **GET `/api/customers`** — Query: `search`, `is_active`, pagination. Example: `GET /api/customers?search=Rahul&page=1`. Success: paginated customers; errors: `401`. Response example: `{"success":true,"message":"customers listed","data":{"items":[{"id":4,"name":"Rahul Kumar"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
30. **GET `/api/customers/:id`** — Path: customer id. Returns profile and calculated balance. Example: `GET /api/customers/4`. Errors: `401`, `404`. Response example: `{"success":true,"message":"Customer profile","data":{"id":4,"name":"Rahul Kumar","balance":1500}}`.
31. **PUT `/api/customers/:id`** — Body: supplied customer fields. Example: `{"phone":"8888888888"}`. Errors: `400`, `401`, `404`. Response example: `{"success":true,"message":"customers updated","data":{"id":4,"phone":"8888888888"}}`.
32. **DELETE `/api/customers/:id`** — Soft-deactivates customer. Example: `DELETE /api/customers/4`. Errors: `401`, `404`. Response example: `{"success":true,"message":"customers deactivated","data":null}`.
33. **GET `/api/customers/:id/transactions`** — Query: pagination. Returns ledger records newest first. Example: `GET /api/customers/4/transactions?page=1`. Errors: `401`, `404`. Response example: `{"success":true,"message":"Customer transactions loaded","data":{"items":[{"type":"sale","amount":2500},{"type":"payment","amount":-1000}],"pagination":{"page":1,"limit":20,"total":2,"pages":1}}}`.

## Purchases (34–38)

All endpoints require JWT and `X-Store-Id`. Item format:
`{product_id,quantity,unit_cost,batch_number?,manufacturing_date?,expiry_date?}`.
The entire purchase, batches, stock transactions, and supplier ledger update are
transactional.

34. **POST `/api/purchases`** — Body: `{supplier_id?,invoice_number?,items:[...],discount_amount?,paid_amount?,notes?}`. Example: `{"supplier_id":3,"items":[{"product_id":10,"quantity":50,"unit_cost":48,"expiry_date":"2026-12-01"}]}`. Success `201`: purchase; errors: `400`, `401`, `404`, `409`. Response example: `{"success":true,"message":"Purchase created","data":{"id":7,"total_amount":2400,"status":"completed"}}`.
35. **GET `/api/purchases`** — Query: `supplier_id`, `from`, `to` (YYYY-MM-DD), pagination. Example: `GET /api/purchases?from=2026-11-01&to=2026-11-10&page=1`. Success: paginated purchases; errors: `400`, `401`. Response example: `{"success":true,"message":"Purchases loaded","data":{"items":[{"id":7,"total_amount":2400}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
36. **GET `/api/purchases/:id`** — Returns purchase and line/batch details. Example: `GET /api/purchases/7`. Errors: `401`, `404`. Response example: `{"success":true,"message":"Purchase details","data":{"id":7,"items":[{"product_id":10,"quantity":50,"unit_cost":48}]}}`.
37. **PUT `/api/purchases/:id`** — Body: same as create; replaces lines. Edit is rejected with `409` if original batch stock has been consumed or the purchase was directly recorded as paid. Example: `{"items":[{"product_id":10,"quantity":45,"unit_cost":48}]}`. Errors: `400`, `401`, `404`, `409`. Response example: `{"success":true,"message":"Purchase updated","data":{"id":7,"total_amount":2160}}`.
38. **DELETE `/api/purchases/:id`** — Cancels purchase and reverses stock only if the purchased quantities remain available. Any direct payment remains as a negative supplier balance (supplier credit/refund due). Example: `DELETE /api/purchases/7`. Errors: `401`, `404`, `409` consumed stock. Response example: `{"success":true,"message":"Purchase cancelled","data":{"id":7,"status":"cancelled"}}`.

## Sales (39–43)

All endpoints require JWT and `X-Store-Id`. Item format:
`{product_id,quantity,unit_price?}`. Sale stock is locked and allocated FEFO
from unexpired batches. Body may include `customer_id`, `discount_amount`,
`paid_amount`, `payment_method` (`cash`, `upi`, `card`, `bank_transfer`,
`credit`, `mixed`) and `notes`. A customer is required when the total is not
fully paid.

39. **POST `/api/sales`** — Creates sale, items, stock transactions, payment record (when customer payment exists), and Khata due atomically. Example: `{"customer_id":4,"payment_method":"credit","items":[{"product_id":10,"quantity":2}]}`. Errors: `400`, `401`, `404`, `409` insufficient stock. Response example: `{"success":true,"message":"Sale created","data":{"id":9,"total_amount":120,"paid_amount":0}}`.
40. **GET `/api/sales`** — Query: `customer_id`, `from`, `to` (YYYY-MM-DD), pagination. Example: `GET /api/sales?from=2026-11-01&page=1`. Errors: `400`, `401`. Response example: `{"success":true,"message":"Sales loaded","data":{"items":[{"id":9,"total_amount":120}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
41. **GET `/api/sales/:id`** — Returns sale and line/batch details. Example: `GET /api/sales/9`. Errors: `401`, `404`. Response example: `{"success":true,"message":"Sale details","data":{"id":9,"items":[{"product_id":10,"quantity":2,"unit_price":60}]}}`.
42. **PUT `/api/sales/:id`** — Body: same as create. Reverses previous stock and ledger entries before replacement; rejected when the sale has a payment or return. Example: `{"customer_id":4,"items":[{"product_id":10,"quantity":1,"unit_price":60}]}`. Errors: `400`, `401`, `404`, `409`. Response example: `{"success":true,"message":"Sale updated","data":{"id":9,"total_amount":60}}`.
43. **POST `/api/sales/:id/return`** — Body: `{items:[{product_id,quantity}],refund_method?,reason?}`. Restocks the original batch and reduces customer due/refund value by the sale's prorated discount. Example: `{"items":[{"product_id":10,"quantity":1}],"refund_method":"cash"}`. Errors: `400`, `401`, `404`. Response example: `{"success":true,"message":"Sale return processed","data":{"sale_id":9,"returned_amount":60}}`.

## Inventory (44–50)

All endpoints require JWT and `X-Store-Id`.

44. **GET `/api/inventory`** — Query: `search`, `category_id`, `low_stock=true`, pagination. Example: `GET /api/inventory?search=milk&page=1`. Errors: `401`. Response example: `{"success":true,"message":"Inventory loaded","data":{"items":[{"id":10,"name":"Milk 1L","stock_quantity":5}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
45. **GET `/api/inventory/:productId`** — Returns product, total quantity, and batches. Example: `GET /api/inventory/10`. Errors: `401`, `404`. Response example: `{"success":true,"message":"Product inventory loaded","data":{"product":{"id":10,"name":"Milk 1L"},"quantity":5,"batches":[]}}`.
46. **GET `/api/inventory/low-stock`** — Query: pagination. Example: `GET /api/inventory/low-stock?page=1`. Errors: `401`. Response example: same inventory envelope filtered to quantities at/below minimum.
47. **GET `/api/inventory/expiring`** — Query: `days` (integer 0–365, defaults 30), pagination. Example: `GET /api/inventory/expiring?days=14&page=1`. Errors: `400`, `401`. Response example: `{"success":true,"message":"Expiring stock loaded","data":{"items":[{"product_id":10,"quantity":2,"expiry_date":"2026-11-20"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
48. **GET `/api/inventory/expired`** — Query: pagination; returns expired on-hand batches plus expiry stock-removal history. Example: `GET /api/inventory/expired?page=1`. Errors: `401`. Response example: `{"success":true,"message":"Expired stock loaded","data":{"items":[{"record_type":"removed","product_id":10,"quantity":1,"occurred_on":"2026-11-01"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
49. **POST `/api/inventory/adjustment`** — Body: `{product_id,quantity_change,reason,batch_number?,expiry_date?,purchase_price?}`. Reasons: `damaged`, `lost`, `found`, `correction`, `wastage`, `other`. Negative changes consume available stock FEFO; positive changes create a batch. Example: `{"product_id":10,"quantity_change":-2,"reason":"damaged"}`. Errors: `400`, `401`, `404`, `409` insufficient stock. Response example: `{"success":true,"message":"Stock adjusted","data":{"quantity_change":-2}}`.
50. **GET `/api/inventory/transactions`** — Query: `product_id`, `type`, `batch_id`, `from`, `to`, pagination. Example: `GET /api/inventory/transactions?product_id=10&from=2026-11-01`. Errors: `400`, `401`. Response example: `{"success":true,"message":"Stock transactions loaded","data":{"items":[{"type":"sale","quantity_change":-2}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.

## Payments and balances (51–54)

All endpoints require JWT and `X-Store-Id`. Methods: `cash`, `upi`, `card`,
`bank_transfer`, `credit`, `mixed`. Customer payment direction is `received`;
supplier payment direction is `paid`. A manual Khata adjustment uses
`transaction_type:"adjustment"`, `adjustment_direction:"debit"|"credit"`, and
`reason`; debit adds to the amount due and credit reduces it.

51. **POST `/api/payments`** — Payment body: `{party_type,party_id,amount,method,direction,reference?,notes?}`; adjustment body: `{party_type,party_id,amount,transaction_type:"adjustment",adjustment_direction,reason}`. Examples: `{"party_type":"customer","party_id":4,"amount":1000,"method":"cash","direction":"received"}` or `{"party_type":"customer","party_id":4,"amount":100,"transaction_type":"adjustment","adjustment_direction":"debit","reason":"Correction"}`. Errors: `400`, `401`, `404`. Response example: `{"success":true,"message":"Payment recorded","data":{"payment_id":12,"transaction_type":"payment","balance":500}}`.
52. **GET `/api/payments`** — Query: `party_type`, `party_id`, pagination. Example: `GET /api/payments?party_type=customer&page=1`. Errors: `401`. Response example: `{"success":true,"message":"Payments loaded","data":{"items":[{"party_type":"customer","amount":1000,"method":"cash"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}}`.
53. **GET `/api/customers/:id/balance`** — Path: customer id. Example: `GET /api/customers/4/balance`. Errors: `401`, `404`. Response example: `{"success":true,"message":"customer balance loaded","data":{"id":4,"name":"Rahul Kumar","balance":500}}`.
54. **GET `/api/suppliers/:id/balance`** — Path: supplier id. Example: `GET /api/suppliers/3/balance`. Errors: `401`, `404`. Response example: `{"success":true,"message":"supplier balance loaded","data":{"id":3,"name":"Fresh Foods Ltd","balance":200}}`.

## Dashboard (55–56)

All endpoints require JWT and `X-Store-Id`.

55. **GET `/api/dashboard`** — No body. Returns product count, stock valuation, today's sales/purchase/profit, low/expiring/expired counts, and total customer/supplier dues. Example: `GET /api/dashboard`. Errors: `401`. Response example: `{"success":true,"message":"Dashboard summary","data":{"totalProducts":12,"totalStockValue":24000,"todaySales":1500,"todayPurchase":500,"todayProfit":300,"lowStockCount":2,"expiringCount":1,"expiredCount":0,"customerDue":800,"supplierDue":400}}`.
56. **GET `/api/dashboard/alerts`** — No body. Returns low-stock products and batches expiring within 30 days (including expired batches). Example: `GET /api/dashboard/alerts`. Errors: `401`. Response example: `{"success":true,"message":"Dashboard alerts","data":{"lowStock":[{"id":10,"quantity":2,"minimum_stock":5}],"expiry":[]}}`.

## Reports (57–62)

All endpoints require JWT and `X-Store-Id`. Date-filtered reports accept
`from` and `to` in `YYYY-MM-DD`.

57. **GET `/api/reports/sales`** — Query: `from`, `to`; grouped by day. Example: `GET /api/reports/sales?from=2026-11-01&to=2026-11-10`. Errors: `400`, `401`. Response example: `{"success":true,"message":"sales report","data":[{"date":"2026-11-10","count":3,"total":1500,"paid":1000}]}`.
58. **GET `/api/reports/purchases`** — Query: `from`, `to`; grouped by day. Example: `GET /api/reports/purchases?from=2026-11-01`. Errors: `400`, `401`. Response example: `{"success":true,"message":"purchases report","data":[{"date":"2026-11-10","count":1,"total":500,"paid":500}]}`.
59. **GET `/api/reports/profit`** — Query: `from`, `to`; returned quantities and sale discounts are deducted from gross margin. Example: `GET /api/reports/profit?from=2026-11-01&to=2026-11-10`. Errors: `400`, `401`. Response example: `{"success":true,"message":"Profit report","data":[{"date":"2026-11-10","revenue":1500,"cost":1200,"profit":250}]}`.
60. **GET `/api/reports/stock`** — No body. Current on-hand stock and purchase-cost valuation per product. Example: `GET /api/reports/stock`. Errors: `401`. Response example: `{"success":true,"message":"Stock report","data":[{"id":10,"name":"Milk 1L","quantity":5,"stock_value":240}]}`.
61. **GET `/api/reports/expiry`** — No body. Returns current expired batches plus expiry-removal and stock-adjustment history. Example: `GET /api/reports/expiry`. Errors: `401`. Response example: `{"success":true,"message":"Expiry and wastage report","data":[{"record_type":"expiry","product_id":10,"quantity":1}]}`.
62. **GET `/api/reports/top-products`** — No body. Returns the top 20 products by gross sold quantity. Example: `GET /api/reports/top-products`. Errors: `401`. Response example: `{"success":true,"message":"Top products report","data":[{"id":10,"name":"Milk 1L","quantity_sold":20,"revenue":1200}]}`.

## Notifications (63–65)

All endpoints require JWT and `X-Store-Id`.

63. **GET `/api/notifications`** — Query: pagination. Returns notifications visible to the user/store. Example: `GET /api/notifications?page=1`. Errors: `401`. Response example: `{"success":true,"message":"Notifications loaded","data":{"items":[],"pagination":{"page":1,"limit":20,"total":0,"pages":0}}}`.
64. **PUT `/api/notifications/:id/read`** — Path: notification id. No body. Example: `PUT /api/notifications/1/read`. Errors: `401`, `404`. Response example: `{"success":true,"message":"Notification marked as read","data":null}`.
65. **PUT `/api/notifications/read-all`** — No body. Marks visible store/user notifications read. Example: `PUT /api/notifications/read-all`. Errors: `401`. Response example: `{"success":true,"message":"Notifications marked as read","data":{"updated":2}}`.

## Implementation notes

- Purchases and sales use MySQL transactions. Purchase edits are blocked when
  their batches have been consumed; sale edits are blocked after any returns.
- Stock is calculated from batches. Expired stock is excluded from sales but
  is swept at startup and every 24 hours into a negative stock transaction and
  notification.
- Mixed payment mode stores an aggregate paid amount and method; it does not
  store separate tender components.
- The expiry sweep creates persisted expiry notifications. Low-stock and
  expiring-soon alerts are returned by the dashboard; they are not currently
  copied into the notifications table by a scheduled producer.
- The test suite checks route count, validation, utility logic, JWT/password
  behavior, and health response. It is not a substitute for integration tests
  against a configured MySQL database and live SMTP/Cloudinary accounts.
