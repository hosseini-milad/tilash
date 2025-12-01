const express = require('express');
const router = express.Router();
const controllers = require('../controllers');

router.get('/', controllers.menus.getAll);
router.post('/', controllers.menus.create);
router.get('/:id', controllers.menus.getOne);
router.put('/:id', controllers.menus.editOne);
router.delete('/:id', controllers.menus.deleteOne);

module.exports = router;
