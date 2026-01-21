import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { CodeList } from '@/components/CodeList';
import { Footer } from '@/components/Footer';
import { mockShiftCodes, GameType, CodeStatus } from '@/data/shiftCodes';

const Index = () => {
  const [selectedGame, setSelectedGame] = useState<GameType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<CodeStatus | 'ALL'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter codes based on selection
  const filteredCodes = useMemo(() => {
    return mockShiftCodes.filter((code) => {
      const gameMatch = selectedGame === 'ALL' || code.game === selectedGame;
      const statusMatch = selectedStatus === 'ALL' || code.status === selectedStatus;
      return gameMatch && statusMatch;
    }).sort((a, b) => {
      // Sort by status (active first) then by date
      const statusOrder = { active: 0, unknown: 1, expired: 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }, [selectedGame, selectedStatus]);

  const activeCodes = mockShiftCodes.filter((c) => c.status === 'active').length;

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate refresh
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Header
        totalCodes={mockShiftCodes.length}
        activeCodes={activeCodes}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 container py-6 space-y-6">
        <FilterBar
          selectedGame={selectedGame}
          selectedStatus={selectedStatus}
          onGameChange={setSelectedGame}
          onStatusChange={setSelectedStatus}
        />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {filteredCodes.length} {filteredCodes.length === 1 ? 'Code' : 'Codes'} Found
            </h2>
          </div>
          <CodeList codes={filteredCodes} />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
