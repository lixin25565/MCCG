import unittest

import app


class CatalogsDataTest(unittest.TestCase):
    def test_catalogs_are_source_of_truth(self):
        self.assertTrue(len(app.CATALOG_ITEMS) > 0)
        self.assertTrue(len(app.CATALOG_ENCHANTMENTS) > 0)
        self.assertTrue(len(app.CATALOG_POTIONS) > 0)
        self.assertFalse(hasattr(app, 'DEFAULT_ITEM_OPTIONS'))
        self.assertFalse(hasattr(app, 'DEFAULT_ENCHANT_OPTIONS'))
        self.assertFalse(hasattr(app, 'DEFAULT_POTION_EFFECT_OPTIONS'))


if __name__ == '__main__':
    unittest.main()
