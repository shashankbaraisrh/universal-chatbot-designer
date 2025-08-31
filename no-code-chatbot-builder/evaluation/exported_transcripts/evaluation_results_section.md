# Evaluation Results

- Items evaluated: **20**
- Mean embedding similarity: **0.652** (95% CI 0.584–0.719)
- Mean BERTScore F1: **0.280** (95% CI 0.245–0.314)
- Mean ROUGE-L F: **0.291**
- Safety OK rate: **100.00%**; Validation marker rate: **55.00%**
- Composite score mean: **0.448** (95% CI 0.404–0.491); Pass@P75 (primary metric) = **25.00%**

## Topic & Length Effects

- See `group_by_topic.csv` and `group_by_prompt_length.csv` for detailed aggregates.
- See `plot_composite_hist.png` and `plot_bertscore_by_topic.png` for figures.

## Qualitative Examples

- High-performing examples: `inspect_top_examples.csv`
- Low-performing examples:  `inspect_bottom_examples.csv`

## Notes on Interpretation

- **Embedding similarity** captures overall semantic alignment and is typically higher than lexical metrics.
- **BERTScore F1** is stricter and better reflects stylistic/phrasing closeness to the gold responses.
- **Safety flags** here use conservative regex rules; they are a quick proxy and may under/over-flag some cases.
- The **composite** combines semantics, lexical alignment, and safety; weights can be tuned to your thesis goals.
