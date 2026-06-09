/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = new Collection({
    "id": "3cz9she1g33ug7x",
    "created": "2026-06-08 10:39:29.123Z",
    "updated": "2026-06-08 10:39:29.123Z",
    "name": "order_sequences",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "xch5nuq7",
        "name": "restaurant_id",
        "type": "text",
        "required": true,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      },
      {
        "system": false,
        "id": "l1vvn8ws",
        "name": "last_code",
        "type": "number",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "noDecimal": false
        }
      }
    ],
    "indexes": [],
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": "",
    "deleteRule": "",
    "options": {}
  });

  return Dao(db).saveCollection(collection);
}, (db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("3cz9she1g33ug7x");

  return dao.deleteCollection(collection);
})
