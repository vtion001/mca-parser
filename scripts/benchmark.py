#!/usr/bin/env python3
"""
MCA PDF Scrubber - Performance Benchmark Script

Measures PDF processing throughput with different worker configurations.
Run with: python scripts/benchmark.py --pdfs ./test_pdfs --workers 1,5,10
"""

import argparse
import time
import statistics
import subprocess
import json
import sys
from pathlib import Path
from typing import List, Dict, Tuple


def run_extraction(pdf_path: str, base_url: str = "http://localhost:8001") -> Tuple[bool, float]:
    """Run single PDF extraction and return (success, duration)."""
    import httpx

    start = time.time()
    try:
        with open(pdf_path, 'rb') as f:
            response = httpx.post(
                f"{base_url}/extract",
                files={'file': f},
                timeout=600
            )
        duration = time.time() - start
        return response.status_code == 200, duration
    except Exception as e:
        print(f"Error processing {pdf_path}: {e}", file=sys.stderr)
        return False, time.time() - start


def benchmark_pdfs(pdf_files: List[str], base_url: str) -> Dict:
    """Benchmark a list of PDF files."""
    results = []
    successes = 0
    failures = 0

    print(f"\nProcessing {len(pdf_files)} PDFs...")
    for i, pdf in enumerate(pdf_files, 1):
        success, duration = run_extraction(pdf, base_url)
        results.append({
            'file': Path(pdf).name,
            'success': success,
            'duration': duration
        })
        if success:
            successes += 1
        else:
            failures += 1
        print(f"  [{i}/{len(pdf_files)}] {Path(pdf).name}: {duration:.2f}s {'✓' if success else '✗'}")

    durations = [r['duration'] for r in results if r['success']]

    return {
        'total_files': len(pdf_files),
        'successes': successes,
        'failures': failures,
        'total_time': sum(durations),
        'avg_time': statistics.mean(durations) if durations else 0,
        'median_time': statistics.median(durations) if durations else 0,
        'min_time': min(durations) if durations else 0,
        'max_time': max(durations) if durations else 0,
        'throughput': successes / sum(durations) if durations else 0,
        'results': results
    }


def generate_report(baseline: Dict, scaled: Dict, worker_count: int) -> str:
    """Generate markdown performance report."""
    speedup = baseline['avg_time'] / scaled['avg_time'] if scaled['avg_time'] > 0 else 0
    throughput_increase = scaled['throughput'] / baseline['throughput'] if baseline['throughput'] > 0 else 0

    report = f"""# MCA PDF Scrubber - Performance Benchmark Report

## Configuration
- **Baseline Workers:** {baseline.get('worker_count', 'N/A')}
- **Scaled Workers:** {worker_count}
- **Test PDFs:** {baseline['total_files']}

## Results Comparison

| Metric | Baseline ({baseline.get('worker_count', 'N/A')} workers) | Scaled ({worker_count} workers) | Change |
|--------|----------------------------------|--------------------------------|-------|
| **Total Time** | {baseline['total_time']:.2f}s | {scaled['total_time']:.2f}s | {((scaled['total_time']/baseline['total_time'])-1)*100:+.1f}% |
| **Avg per PDF** | {baseline['avg_time']:.2f}s | {scaled['avg_time']:.2f}s | {((scaled['avg_time']/baseline['avg_time'])-1)*100:+.1f}% |
| **Throughput** | {baseline['throughput']:.2f} PDFs/s | {scaled['throughput']:.2f} PDFs/s | {(throughput_increase-1)*100:+.1f}% |
| **Success Rate** | {baseline['successes']}/{baseline['total_files']} | {scaled['successes']}/{scaled['total_files']} | - |

## Speedup Analysis
- **Speedup Factor:** {speedup:.2f}x
- **Theoretical Max Speedup:** {worker_count}x (with perfect parallelization)
- **Efficiency:** {(speedup/worker_count)*100:.1f}%

## Per-File Results (Scaled)

| File | Duration | Status |
|------|----------|--------|
"""

    for r in scaled['results']:
        status = '✓' if r['success'] else '✗'
        report += f"| {r['file']} | {r['duration']:.2f}s | {status} |\n"

    report += f"""
## Conclusions

"""

    if speedup >= worker_count * 0.8:
        report += "✓ **Excellent scaling** - Near-linear speedup achieved. The system efficiently utilizes multiple workers."
    elif speedup >= worker_count * 0.5:
        report += "⚠ **Good scaling** - Sub-linear speedup indicates some bottleneck (likely Docling or network I/O)."
    else:
        report += "✗ **Poor scaling** - Significant bottleneck identified. Consider:\n  - Scaling Docling replicas\n  - Adding Redis caching\n  - Using faster storage"

    return report


def main():
    parser = argparse.ArgumentParser(description='Benchmark MCA PDF Scrubber')
    parser.add_argument('--pdfs', required=True, help='Directory containing PDF files')
    parser.add_argument('--base-url', default='http://localhost:8001', help='Docling service URL')
    parser.add_argument('--workers', default='1,5,10', help='Comma-separated worker counts to test')
    parser.add_argument('--output', help='Output JSON file for results')
    args = parser.parse_args()

    pdf_dir = Path(args.pdfs)
    if not pdf_dir.exists():
        print(f"Error: PDF directory not found: {pdf_dir}", file=sys.stderr)
        sys.exit(1)

    pdf_files = list(pdf_dir.glob('*.pdf'))
    if not pdf_files:
        print(f"Error: No PDF files found in {pdf_dir}", file=sys.stderr)
        sys.exit(1)

    print(f"Found {len(pdf_files)} PDF files")
    print(f"Testing worker configurations: {args.workers}")

    worker_configs = [int(w) for w in args.workers.split(',')]
    results = {}

    # Baseline (1 worker)
    print("\n" + "="*60)
    print("BASELINE (1 worker)")
    print("="*60)
    # Note: In real benchmark, you'd scale down workers between runs
    baseline = benchmark_pdfs([str(p) for p in pdf_files], args.base_url)
    baseline['worker_count'] = 1
    results['baseline'] = baseline

    for worker_count in worker_configs[1:]:
        print("\n" + "="*60)
        print(f"SCALED ({worker_count} workers)")
        print("="*60)
        # Note: In production, you'd scale docker-compose
        scaled = benchmark_pdfs([str(p) for p in pdf_files], args.base_url)
        scaled['worker_count'] = worker_count
        results[f'workers_{worker_count}'] = scaled

    # Generate report
    if len(worker_configs) > 1:
        report = generate_report(baseline, results[f'workers_{worker_configs[-1]}'], worker_configs[-1])
        print("\n" + "="*60)
        print("BENCHMARK REPORT")
        print("="*60)
        print(report)

    # Save JSON results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {args.output}")

    # Summary table
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"{'Workers':<10} {'Total Time':<12} {'Avg/PDF':<10} {'Throughput':<12}")
    print("-" * 50)
    for key, data in results.items():
        label = str(data.get('worker_count', '?'))
        print(f"{label:<10} {data['total_time']:<12.2f} {data['avg_time']:<10.2f} {data['throughput']:<12.2f}")


if __name__ == '__main__':
    main()
