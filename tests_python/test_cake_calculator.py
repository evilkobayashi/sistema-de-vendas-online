import unittest

from cake_calculator import calculate_recipe, format_amount


class CakeCalculatorTest(unittest.TestCase):
    def test_calculates_ingredients_for_servings_and_pan(self):
        recipe = calculate_recipe("chocolate", 20, "redonda-25")

        self.assertEqual(recipe["flavor"], "Bolo de chocolate")
        self.assertEqual(recipe["servings"], 20)
        self.assertEqual(recipe["pan"], "Forma redonda 25 cm")
        self.assertEqual(recipe["multiplier"], "2,7")
        self.assertEqual(recipe["ingredients"][0]["amount"], "5,4")

    def test_rejects_invalid_servings(self):
        with self.assertRaisesRegex(ValueError, "entre 4 e 60"):
            calculate_recipe("baunilha", 2, "redonda-20")

    def test_rejects_invalid_flavor(self):
        with self.assertRaisesRegex(ValueError, "sabor válido"):
            calculate_recipe("morango", 12, "redonda-20")

    def test_formats_amount_for_brazilian_readability(self):
        self.assertEqual(format_amount(2), "2")
        self.assertEqual(format_amount(1.5), "1,5")
        self.assertEqual(format_amount(1.25), "1,25")


if __name__ == "__main__":
    unittest.main()
