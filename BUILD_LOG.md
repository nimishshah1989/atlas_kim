# ATLAS_KIM BUILD LOG

## 2026-04-23 09:30 UTC — Phase 0 Complete, Phase 1 Starting
- Workspace: /home/ubuntu/atlas_kim
- Data cleanup done on JIP DB (deduped corporate actions, fixed MF weights)
- Phase 1: Schema + Models

## Benchmarks (discovering now)
1. Nifty 50 → de_index_prices.index_code = 'NIFTY 50'
2. Nifty 500 → de_index_prices.index_code = 'NIFTY 500'
3. S&P 500 → discovering ticker
4. MSCI World → discovering ticker
5. Gold → discovering ticker

## 2026-04-23 09:35 UTC — Benchmark Mapping Decided
| Benchmark | Source Table | Source Key | Data Quality |
|-----------|-------------|------------|--------------|
| Nifty 50 | de_index_prices | index_code='NIFTY 50' | ✅ Excellent |
| Nifty 500 | de_index_prices | index_code='NIFTY 500' | ✅ Excellent |
| S&P 500 | de_global_prices | ticker='^GSPC' | ⚠️ Thin (5 rows) - pipeline handles gracefully |
| MSCI World | de_global_prices | ticker='URTH' | ⚠️ Thin (5 rows) - pipeline handles gracefully |
| Gold | de_global_prices | ticker='GC=F' | ⚠️ Thin (9 rows) - pipeline handles gracefully |

**Decision:** Pipeline computes RS for all 5 benchmarks. If benchmark has < 30 days of history, that RS column is NULL. Frontend shows "Insufficient data" badge.

## Starting Phase 1: Schema + Models
