export function Header() {
  return (
    <header className="py-8 px-8 border-b border-bw-100">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 border-2 border-black rounded-lg flex items-center justify-center">
            <span className="text-2xl font-mono font-bold text-black">M</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-bw-900">MCA PDF Scrubber</h1>
            <p className="text-sm text-bw-400 font-light">Docling-powered text analysis</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-black rounded-full"></div>
          <span className="text-sm text-bw-500 font-medium tracking-wide uppercase">Ready</span>
        </div>
      </div>
    </header>
  );
}
