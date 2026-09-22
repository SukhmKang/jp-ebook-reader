import unittest

from sense_reranker import MAX_LENGTH, _encode_pair, _softmax


class FakeTokenizer:
    bos_token_id = 0
    eos_token_id = 2

    def encode(self, text, add_special_tokens=False):
        del add_special_tokens
        return [ord(char) for char in text]

    def num_special_tokens_to_add(self, pair=False):
        return 4 if pair else 2


class SenseRerankerFormattingTest(unittest.TestCase):
    def test_long_context_keeps_marked_target_and_pair_budget(self):
        occurrence = {
            "context": "前" * 500 + "頭" + "後" * 500,
            "charOffset": 500,
            "target": "頭",
            "reading": "あたま",
        }
        encoded = _encode_pair(FakeTokenizer(), occurrence, {"text": "head" * 50})
        marker = [ord(char) for char in "<t>頭</t>"]
        ids = encoded["input_ids"]

        self.assertLessEqual(len(ids), MAX_LENGTH)
        self.assertTrue(any(ids[index:index + len(marker)] == marker for index in range(len(ids))))

    def test_softmax_is_normalized_and_ordered(self):
        values = _softmax([1.0, 3.0, 2.0])
        self.assertAlmostEqual(sum(values), 1.0)
        self.assertGreater(values[1], values[2])
        self.assertGreater(values[2], values[0])


if __name__ == "__main__":
    unittest.main()
