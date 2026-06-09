/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("orders")

  collection.schema.addField(new SchemaField({
    "name": "delivery_name",
    "type": "text",
    "required": false,
    "options": { "min": null, "max": null, "pattern": "" }
  }))

  collection.schema.addField(new SchemaField({
    "name": "delivery_phone",
    "type": "text",
    "required": false,
    "options": { "min": null, "max": null, "pattern": "" }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("orders")

  const deliveryName = collection.schema.getFieldByName("delivery_name")
  if (deliveryName) collection.schema.removeField(deliveryName.id)

  const deliveryPhone = collection.schema.getFieldByName("delivery_phone")
  if (deliveryPhone) collection.schema.removeField(deliveryPhone.id)

  return dao.saveCollection(collection)
})
