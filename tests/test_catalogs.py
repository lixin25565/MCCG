import os
import subprocess
import sys
import tempfile
import textwrap
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

    def test_app_starts_from_any_working_directory(self):
        project_root = os.path.dirname(os.path.dirname(__file__))
        with tempfile.TemporaryDirectory() as temp_dir:
            code = textwrap.dedent(f"""
                import sys
                sys.path.insert(0, {project_root!r})
                import app
                print('loaded', app.app.name)
            """)
            result = subprocess.run(
                [sys.executable, '-c', code],
                cwd=temp_dir,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, msg=result.stderr or result.stdout)
            self.assertIn('loaded', result.stdout)


if __name__ == '__main__':
    unittest.main()
