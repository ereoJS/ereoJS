interface BlogLayoutProps {
  children: React.ReactNode;
}

export default function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <div className="min-h-screen">
      {/* Blog Header */}
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Blog</h1>
          <p className="text-primary-100">Tutorials, guides, and updates from the EreoJS team</p>
        </div>
      </div>

      {/* Blog Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        {children}
      </div>
    </div>
  );
}