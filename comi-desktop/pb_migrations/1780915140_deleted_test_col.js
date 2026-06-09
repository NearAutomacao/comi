/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db);
  const collection = dao.findCollectionByNameOrId("ot4dcaj2bjh3c31");

  return dao.deleteCollection(collection);
}, (db) => {
  const collection = new Collection({
    "id": "ot4dcaj2bjh3c31",
    "created": "2026-06-08 10:38:30.234Z",
    "updated": "2026-06-08 10:38:30.234Z",
    "name": "test_col",
    "type": "base",
    "system": false,
    "schema": [
      {
        "system": false,
        "id": "58cmhi31",
        "name": "title",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
          "min": null,
          "max": null,
          "pattern": ""
        }
      }
    ],
    "indexes": [],
    "listRule": null,
    "viewRule": null,
    "createRule": null,
    "updateRule": null,
    "deleteRule": null,
    "options": {}
  });

  return Dao(db).saveCollection(collection);
})
