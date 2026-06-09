/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ae2ug6z8xqiorzj")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "l634rtoa",
    "name": "day_of_week",
    "type": "number",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "noDecimal": false
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ae2ug6z8xqiorzj")

  // update
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "l634rtoa",
    "name": "day_of_week",
    "type": "number",
    "required": true,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "noDecimal": false
    }
  }))

  return dao.saveCollection(collection)
})
