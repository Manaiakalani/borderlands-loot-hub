import { useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { CodeList } from '@/components/CodeList';
import { NewTodaySection } from '@/components/NewTodaySection';
import { Footer } from '@/components/Footer';
import { ParticleBackground } from '@/components/ParticleBackground';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { useShiftCodes } from '@/hooks/useShiftCodes';
import { GameType, CodeStatus } from '@/data/shiftCodes';
import { Clock } from 'lucide-react';

/** Status sorting priority - lower numbers appear first */
const STATUS_SORT_ORDER: Record<CodeStatus, number> = {
  active: 0,
  unknown: 1,
  expired: 2,
};

const Index = () => {
  const [selectedGame, setSelectedGame] = useState<GameType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<CodeStatus | 'ALL'>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { 
    codes, 
    isLoading, 
    lastFetched, 
    refresh, 
    newTodayCodes,
    activeCodes,
    isNewToday,
    isRecent,
    isStale,
    nextRefreshIn,
    dataSource,
  } = useShiftCodes();

  // Determine if we show the "New Today" section
  const showNewTodaySection = selectedGame === 'ALL' && selectedStatus === 'ALL' && newTodayCodes.length > 0;

  // Filter and sort codes based on selection
  const filteredCodes = useMemo(() => {
    return codes.filter((code) => {
      const gameMatch = selectedGame === 'ALL' || code.game === selectedGame;
      const statusMatch = selectedStatus === 'ALL' || code.status === selectedStatus;
      // Exclude "new today" codes from main list when showing the special section
      const notInNewSection = !showNewTodaySection || !isNewToday(code);
      return gameMatch && statusMatch && notInNewSection;
    }).sort((a, b) => {
      // Sort by status (active first) then by date (newest first)
      const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
  }, [codes, selectedGame, selectedStatus, showNewTodaySection, isNewToday]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Floating Particles */}
      <ParticleBackground />
      
      {/* Background Pattern with Hexagon texture */}
      <div className="fixed inset-0 -z-10 overflow-hidden hex-pattern">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        {/* Subtle scan lines overlay */}
        <div className="absolute inset-0 scanlines opacity-50" />
      </div>

      <Header
        totalCodes={codes.length}
        activeCodes={activeCodes}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        lastFetched={lastFetched}
        isStale={isStale}
        nextRefreshIn={nextRefreshIn}
        dataSource={dataSource}
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
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-muted-foreground">Loading SHiFT codes...</p>
            </div>
            <SkeletonGrid count={6} />
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
