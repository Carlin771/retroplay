export default function Row({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-4 text-lg font-bold md:px-8">{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2 md:px-8">
        {children}
      </div>
    </section>
  );
}
