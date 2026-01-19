import MainContent from '@/components/MainContent';

export default function Home() {
  return (
    <div className="container">
      <header className="mb-8">
        <h1>Sistema de Migracion PACS</h1>
        <p className="text-gray">Migracion de informes radiologicos a PACS</p>
      </header>

      <MainContent />
    </div>
  );
}
