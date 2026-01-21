import { useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { CodeList } from '@/components/CodeList';
import { NewTodaySection } from '@/components/NewTodaySection';
import { Footer } from '@/components/Footer';
import { useShiftCodes } from '@/hooks/useShiftCodes';
import { GameType, CodeStatus } from '@/data/shiftCodes';
import { Loader2, Clock } from 'lucide-react';

const Index = () => {
  const [selectedGame, setSelectedGame] = useState<GameType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<CodeStatus | 'ALL'>('ALL');
  
  const { 
    codes, 
    isLoading, 
    lastFetched, 
    refresh, 
    newTodayCodes,
    activeCodes,
    isNewToday,
    isRecent,
  } = useShiftCodes();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter codes based on selection
  const filteredCodes = useMemo(() => {
    return codes.filter((code) => {
      const gameMatch = selectedGame === 'ALL' || code.game === selectedGame;
      const statusMatch = selectedStatus === 'ALL' || code.status === selectedStatus;
      // Exclude "new today" codes from main list when showing all
      const notInNewSection = selectedGame !== 'ALL' || selectedStatus !== 'ALL' || !isNewToday(code);
      return gameMatch && statusMatch && notInNewSection;
    }).sort((a, b) => {
      // Sort by status (active first) then by date
      const statusOrder = { active: 0, unknown: 1, expired: 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }, [codes, selectedGame, selectedStatus, isNewToday]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  // Show "New Today" section only when viewing all codes
  const showNewTodaySection = selectedGame === 'ALL' && selectedStatus === 'ALL' && newTodayCodes.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Header
        totalCodes={codes.length}
        activeCodes={activeCodes}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 container py-6 space-y-6">
        {/* Last fetched indicator */}
        {lastFetched && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
            <Clock className="w-3 h-3" />
            <span>
              Last updated: {lastFetched.toLocaleTimeString()}
              {' • '}
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-primary hover:underline transition-colors"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh now'}
              </button>
            </span>
          </div>
        )}

        <FilterBar
          selectedGame={selectedGame}
          selectedStatus={selectedStatus}
          onGameChange={setSelectedGame}
          onStatusChange={setSelectedStatus}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading SHiFT codes...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* New Today Section */}
            {showNewTodaySection && (
              <NewTodaySection codes={newTodayCodes} />
            )}

            {/* All Codes Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  {showNewTodaySection ? 'All Codes' : `${filteredCodes.length} ${filteredCodes.length === 1 ? 'Code' : 'Codes'} Found`}
                </h2>
                {showNewTodaySection && (
                  <span className="text-sm text-muted-foreground">
                    {filteredCodes.length} codes
                  </span>
                )}
              </div>
              <CodeList codes={filteredCodes} isRecentFn={isRecent} />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Index;
