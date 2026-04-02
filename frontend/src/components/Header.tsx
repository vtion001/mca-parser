export function Header() {
  return (
    <header className="py-8 px-8 border-b border-bw-100">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src="https://res.cloudinary.com/dbviya1rj/image/upload/v1775062877/gm3qwskgtgktqezpjmoo.png"
            alt="Dave Logo"
            className="w-24 h-24 object-contain"
          />
          <div>
            <p className="text-sm text-bw-400 font-light">Powered by Alliance Global Solutions</p>
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
