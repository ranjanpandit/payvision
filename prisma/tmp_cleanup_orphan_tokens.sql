DELETE t
FROM merchantapitoken t
LEFT JOIN merchant m ON m.merchantId = t.merchantId
WHERE m.merchantId IS NULL;
