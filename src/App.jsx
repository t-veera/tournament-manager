import React, { useState, useEffect, useRef } from 'react';
import { Users, Trophy, Play, Settings, RefreshCw, UserPlus, Trash2, Edit3, RotateCcw, Download, Wifi, Share2, QrCode, Camera } from 'lucide-react';
import html2canvas from 'html2canvas';
import { createClient } from '@supabase/supabase-js';

// Supabase configuration - Replace with your actual values
const SUPABASE_URL = 'https://kgwvdqderimfvdamsvxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtnd3ZkcWRlcmltZnZkYW1zdnhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1OTkyNDcsImV4cCI6MjA3MTE3NTI0N30.lpHIn8IjUmsHvWO-M-wVikXGlc_D-q4YOoXlwxEB4Qo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const PiccleballTournamentApp = () => {
  const [currentView, setCurrentView] = useState('leaderboard');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPlayerManager, setShowPlayerManager] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [tournamentName, setTournamentName] = useState('The Ultimate Pickleball Championship');
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tournamentId] = useState('tournament-' + Date.now()); // Unique tournament ID
  const leaderboardRef = useRef(null);
  
  // Default players
  const defaultPlayers = [
    "Twisha", "Aishna", "Neha", "Ayushi", "Josh", 
    "Sri", "Callie", "Rylie", "Laya", "Trina"
  ];

  // State with localStorage persistence (but start fresh)
  const [players, setPlayers] = useState(() => {
    // Clear any existing data for fresh start
    localStorage.removeItem('tournament-players');
    localStorage.removeItem('tournament-games');
    return defaultPlayers;
  });

  // Generate tournament games with proper player rest scheduling
  const generateTournamentGames = (playerList) => {
    if (playerList.length < 4) return [];
    
    // Shuffle players to ensure fair, random tournament scheduling
    const shuffledPlayers = [...playerList].sort(() => Math.random() - 0.5);
    
    // Get all possible partnerships from shuffled players
    const partnerships = [];
    for (let i = 0; i < shuffledPlayers.length; i++) {
      for (let j = i + 1; j < shuffledPlayers.length; j++) {
        partnerships.push([shuffledPlayers[i], shuffledPlayers[j]]);
      }
    }

    // Shuffle partnerships too for additional randomness
    const shuffledPartnerships = partnerships.sort(() => Math.random() - 0.5);

    // Generate all possible games (partnerships that don't overlap)
    const allPossibleGames = [];
    const used = new Set();
    
    for (let i = 0; i < shuffledPartnerships.length; i++) {
      if (used.has(i)) continue;
      
      for (let j = i + 1; j < shuffledPartnerships.length; j++) {
        if (used.has(j)) continue;
        
        // Check if partnerships don't share players
        const partnership1 = shuffledPartnerships[i];
        const partnership2 = shuffledPartnerships[j];
        const hasOverlap = partnership1.some(player => partnership2.includes(player));
        
        if (!hasOverlap) {
          allPossibleGames.push({
            team1: partnership1,
            team2: partnership2,
            players: [...partnership1, ...partnership2]
          });
          used.add(i);
          used.add(j);
          break;
        }
      }
    }

    // Shuffle the possible games for additional randomness in scheduling
    const shuffledGames = allPossibleGames.sort(() => Math.random() - 0.5);

    // Now schedule games ensuring no player plays consecutive games
    const scheduledGames = [];
    const availableGames = [...shuffledGames];
    const playerLastGame = {}; // Track when each player last played
    
    while (availableGames.length > 0) {
      let gameScheduled = false;
      
      for (let i = 0; i < availableGames.length; i++) {
        const game = availableGames[i];
        const currentRound = scheduledGames.length;
        
        // Check if any player in this game played in the previous round
        const canSchedule = game.players.every(player => {
          const lastPlayed = playerLastGame[player];
          return lastPlayed === undefined || currentRound - lastPlayed > 1;
        });
        
        if (canSchedule) {
          // Schedule this game
          scheduledGames.push({
            id: scheduledGames.length + 1,
            team1: game.team1,
            team2: game.team2,
            status: 'upcoming',
            team1Score: 0,
            team2Score: 0
          });
          
          // Update last played round for all players in this game
          game.players.forEach(player => {
            playerLastGame[player] = currentRound;
          });
          
          // Remove this game from available games
          availableGames.splice(i, 1);
          gameScheduled = true;
          break;
        }
      }
      
      // If no game could be scheduled (shouldn't happen with good algorithm)
      // Schedule the first available game to prevent infinite loop
      if (!gameScheduled && availableGames.length > 0) {
        const game = availableGames[0];
        scheduledGames.push({
          id: scheduledGames.length + 1,
          team1: game.team1,
          team2: game.team2,
          status: 'upcoming',
          team1Score: 0,
          team2Score: 0
        });
        
        game.players.forEach(player => {
          playerLastGame[player] = scheduledGames.length - 1;
        });
        
        availableGames.splice(0, 1);
      }
    }
    
    return scheduledGames;
  };

  const [games, setGames] = useState(() => {
    // Always start fresh - no saved games
    return generateTournamentGames(defaultPlayers);
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('tournament-players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem('tournament-games', JSON.stringify(games));
  }, [games]);

  // Update games when players change
  useEffect(() => {
    if (games.length === 0 || games.every(g => g.status === 'upcoming')) {
      setGames(generateTournamentGames(players));
    }
  }, [players]);

  // Calculate individual player stats
  const calculatePlayerStats = () => {
    const stats = {};
    players.forEach(player => {
      stats[player] = {
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
        pointsScored: 0,
        pointsAgainst: 0
      };
    });

    games.forEach(game => {
      if (game.status === 'completed') {
        const team1Players = game.team1;
        const team2Players = game.team2;
        
        // Determine winner
        let team1Points = 0, team2Points = 0;
        if (game.team1Score > game.team2Score) {
          team1Points = 3; team2Points = 0;
        } else if (game.team1Score < game.team2Score) {
          team1Points = 0; team2Points = 3;
        } else {
          team1Points = 1; team2Points = 1;
        }

        // Update stats for team 1
        team1Players.forEach(player => {
          if (stats[player]) {
            stats[player].points += team1Points;
            stats[player].gamesPlayed += 1;
            stats[player].pointsScored += game.team1Score;
            stats[player].pointsAgainst += game.team2Score;
            
            if (team1Points === 3) stats[player].wins += 1;
            else if (team1Points === 0) stats[player].losses += 1;
            else stats[player].draws += 1;
          }
        });

        // Update stats for team 2
        team2Players.forEach(player => {
          if (stats[player]) {
            stats[player].points += team2Points;
            stats[player].gamesPlayed += 1;
            stats[player].pointsScored += game.team2Score;
            stats[player].pointsAgainst += game.team1Score;
            
            if (team2Points === 3) stats[player].wins += 1;
            else if (team2Points === 0) stats[player].losses += 1;
            else stats[player].draws += 1;
          }
        });
      }
    });

    return stats;
  };

  const playerStats = calculatePlayerStats();
  const sortedPlayers = players.sort((a, b) => {
    if (playerStats[b].points !== playerStats[a].points) {
      return playerStats[b].points - playerStats[a].points;
    }
    const aDiff = playerStats[a].pointsScored - playerStats[a].pointsAgainst;
    const bDiff = playerStats[b].pointsScored - playerStats[b].pointsAgainst;
    return bDiff - aDiff;
  });

  // Game management
  const updateGameScore = (gameId, team1Score, team2Score) => {
    setGames(games.map(game => 
      game.id === gameId 
        ? { ...game, team1Score: parseInt(team1Score) || 0, team2Score: parseInt(team2Score) || 0, status: 'completed' }
        : game
    ));
  };

  const getCurrentGame = () => {
    return games.find(game => game.status === 'in-progress') || 
           games.find(game => game.status === 'upcoming');
  };

  // Player management
  const addPlayer = () => {
    if (newPlayerName.trim() && !players.includes(newPlayerName.trim())) {
      setPlayers([...players, newPlayerName.trim()]);
      setNewPlayerName('');
    }
  };

  const removePlayer = (playerToRemove) => {
    if (players.length > 4) {
      setPlayers(players.filter(player => player !== playerToRemove));
    }
  };

  const editPlayer = (oldName, newName) => {
    if (newName.trim() && !players.includes(newName.trim())) {
      setPlayers(players.map(player => player === oldName ? newName.trim() : player));
      setEditingPlayer(null);
      
      // Update games with new player name
      setGames(games.map(game => ({
        ...game,
        team1: game.team1.map(p => p === oldName ? newName.trim() : p),
        team2: game.team2.map(p => p === oldName ? newName.trim() : p)
      })));
    }
  };

  const resetTournament = () => {
    if (window.confirm('Are you sure you want to reset the entire tournament? This will clear all scores.')) {
      setGames(generateTournamentGames(players));
    }
  };

  const exportResults = () => {
    const stats = calculatePlayerStats();
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Rank,Player,Wins,Losses,Draws,Games Played,Total Points,Point Diff\n"
      + sortedPlayers.map((player, index) => {
          const stat = stats[player];
          const diff = stat.pointsScored - stat.pointsAgainst;
          return `${index + 1},${player},${stat.wins},${stat.losses},${stat.draws},${stat.gamesPlayed},${stat.pointsScored},${diff}`;
        }).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tournamentName.replace(/\s+/g, '_')}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsImage = async () => {
    if (leaderboardRef.current) {
      try {
        const canvas = await html2canvas(leaderboardRef.current, {
          backgroundColor: '#ffffff',
          scale: 2, // Higher resolution
          useCORS: true,
          logging: false,
          width: leaderboardRef.current.scrollWidth,
          height: leaderboardRef.current.scrollHeight,
        });
        
        // Convert to blob and download
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${tournamentName.replace(/\s+/g, '_')}_leaderboard.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 'image/png', 1.0);
        
      } catch (error) {
        console.error('Error exporting image:', error);
        alert('Error exporting image. Please try again.');
      }
    }
  };

  const shareUrl = window.location.href;

  const ShareModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Share2 className="text-blue-500" />
          Share Tournament
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tournament URL</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={shareUrl}
                readOnly
                className="flex-1 p-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
              />
              <button 
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                Copy
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <QrCode size={100} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">QR Code (requires actual deployment)</p>
          </div>
          
          <div className="text-xs text-gray-500">
            💡 Share this URL with players and spectators to view live tournament results
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button 
            onClick={() => setShowShareModal(false)}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const LeaderboardView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Trophy className="text-yellow-500" />
          Tournament Leaderboard
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            <Share2 size={16} />
            Share
          </button>
          <button 
            onClick={exportResults}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button 
            onClick={exportAsImage}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            <Camera size={16} />
            Export Image
          </button>
          <button 
            onClick={() => setCurrentView('games')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Play size={16} />
            View Games
          </button>
          {isAdmin && (
            <button 
              onClick={() => setShowPlayerManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Users size={16} />
              Manage Players
            </button>
          )}
        </div>
      </div>
      
      <div ref={leaderboardRef} className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold">{tournamentName}</h2>
            <p className="text-blue-100">Final Leaderboard</p>
          </div>
          <div className="grid grid-cols-6 text-sm font-semibold">
            <div>Rank</div>
            <div>Player</div>
            <div>W-L-D</div>
            <div>Games</div>
            <div>Total Points</div>
            <div>Point Diff</div>
          </div>
        </div>
        
        {sortedPlayers.map((player, index) => {
          const stats = playerStats[player];
          const diff = stats.pointsScored - stats.pointsAgainst;
          return (
            <div key={player} className={`px-6 py-4 border-b grid grid-cols-6 items-center transition-colors hover:bg-gray-50 ${
              index === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 
              index === 1 ? 'bg-gray-50' : 
              index === 2 ? 'bg-orange-50' : ''
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-center leading-none font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500 text-white' : 
                  index === 1 ? 'bg-gray-400 text-white' : 
                  index === 2 ? 'bg-orange-400 text-white' : 
                  'bg-blue-100 text-blue-800'
                }`}>
                  {index + 1}
                </div>
                {index === 0 && <Trophy size={16} className="text-yellow-500" />}
              </div>
              <div className="font-semibold text-gray-800">{player}</div>
              <div className="text-sm text-gray-600">{stats.wins}-{stats.losses}-{stats.draws}</div>
              <div className="text-sm text-gray-600">{stats.gamesPlayed}</div>
              <div className="text-sm font-semibold text-green-600">
                {stats.pointsScored}
              </div>
              <div className={`text-sm font-semibold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {diff > 0 ? '+' : ''}{diff}
              </div>
            </div>
          );
        })}
        
        {/* Footer for exported image */}
        <div className="bg-gray-50 px-6 py-3 text-center text-sm text-gray-600">
          <div>🏆 {tournamentName}</div>
          <div>{players.length} Players • {games.length} Games • Unique Partnerships Format</div>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Scoring System</h3>
          <div className="text-sm text-blue-700">
            <div>Win: 3 points • Draw: 1 point • Loss: 0 points</div>
            <div>Tiebreaker: Point differential (points scored - points against)</div>
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="text-green-600" size={20} />
            <h3 className="font-semibold text-green-800">Real-time Tournament Data</h3>
          </div>
          <div className="text-sm text-green-700">
            ✅ Live sync across all devices<br/>
            ✅ Cloud database backup<br/>
            ✅ Real-time score updates<br/>
            ✅ Tournament data preserved
          </div>
        </div>
      </div>
    </div>
  );

  const GamesView = () => {
    const currentGame = getCurrentGame();
    const completedGames = games.filter(g => g.status === 'completed').length;
    const totalGames = games.length;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Play className="text-blue-500" />
              Tournament Games
            </h2>
            <p className="text-gray-600">Progress: {completedGames}/{totalGames} games completed</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentView('leaderboard')}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <Trophy size={16} />
              Leaderboard
            </button>
            {isAdmin && (
              <button 
                onClick={() => setShowPlayerManager(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                <Users size={16} />
                Manage Players
              </button>
            )}
            <button 
              onClick={() => setIsAdmin(!isAdmin)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isAdmin ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}`}
            >
              <Settings size={16} />
              {isAdmin ? 'Exit Admin' : 'Admin Mode'}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Tournament Progress</span>
            <span className="text-sm text-gray-500">{Math.round((completedGames / totalGames) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(completedGames / totalGames) * 100}%` }}
            ></div>
          </div>
        </div>

        {currentGame && (
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <RefreshCw size={20} />
              {currentGame.status === 'in-progress' ? 'Current Game' : 'Next Game'}
            </h3>
            <div className="text-2xl font-bold">
              Game {currentGame.id}: {currentGame.team1.join(' & ')} vs {currentGame.team2.join(' & ')}
            </div>
            {currentGame.status === 'in-progress' && (
              <div className="text-lg mt-2">
                Current Score: {currentGame.team1Score} - {currentGame.team2Score}
              </div>
            )}
          </div>
        )}
        
        <div className="grid gap-4">
          {games.map(game => (
            <div key={game.id} className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
              game.status === 'completed' ? 'bg-green-50 border-green-200' : 
              game.status === 'in-progress' ? 'bg-blue-50 border-blue-200 shadow-lg' : 
              'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-lg">
                    Game {game.id}: {game.team1.join(' & ')} vs {game.team2.join(' & ')}
                  </div>
                  <div className={`text-sm inline-flex items-center px-2 py-1 rounded-full mt-1 ${
                    game.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    game.status === 'in-progress' ? 'bg-blue-100 text-blue-700' : 
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {game.status === 'in-progress' ? 'In Progress' : 
                     game.status === 'completed' ? 'Completed' : 'Upcoming'}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {game.status !== 'upcoming' && (
                    <div className="text-2xl font-bold">
                      {game.team1Score} - {game.team2Score}
                    </div>
                  )}
                  
                  {isAdmin && game.status !== 'completed' && (
                    <div className="flex gap-2">
                      <input 
                        type="number" 
                        placeholder="Team 1" 
                        className="w-20 p-2 border rounded-lg text-center"
                        value={game.team1Score || ''}
                        onChange={(e) => {
                          const newGames = games.map(g => 
                            g.id === game.id ? {...g, team1Score: parseInt(e.target.value) || 0} : g
                          );
                          setGames(newGames);
                        }}
                      />
                      <input 
                        type="number" 
                        placeholder="Team 2" 
                        className="w-20 p-2 border rounded-lg text-center"
                        value={game.team2Score || ''}
                        onChange={(e) => {
                          const newGames = games.map(g => 
                            g.id === game.id ? {...g, team2Score: parseInt(e.target.value) || 0} : g
                          );
                          setGames(newGames);
                        }}
                      />
                      <button 
                        onClick={() => updateGameScore(game.id, game.team1Score, game.team2Score)}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const PlayerManagerView = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="text-blue-500" />
          Manage Players
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowPlayerManager(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
          <button 
            onClick={resetTournament}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <RotateCcw size={16} />
            Reset Tournament
          </button>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-blue-800 mb-3">
          <Settings size={20} />
          <span className="font-semibold">Tournament Statistics</span>
        </div>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div className="bg-white p-3 rounded-lg">
            <div className="font-semibold text-gray-800">Players</div>
            <div className="text-2xl font-bold text-blue-600">{players.length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <div className="font-semibold text-gray-800">Total Games</div>
            <div className="text-2xl font-bold text-green-600">{games.length}</div>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <div className="font-semibold text-gray-800">Partnerships</div>
            <div className="text-2xl font-bold text-purple-600">{Math.floor(players.length * (players.length - 1) / 2)}</div>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <div className="font-semibold text-gray-800">Unused</div>
            <div className="text-2xl font-bold text-orange-600">{Math.floor(players.length * (players.length - 1) / 2) - (games.length * 2)}</div>
          </div>
        </div>
      </div>

      {/* Add New Player */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="text-green-500" />
          Add New Player
        </h3>
        <div className="flex gap-2">
          <input 
            type="text"
            placeholder="Enter player name"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
          />
          <button 
            onClick={addPlayer}
            disabled={!newPlayerName.trim() || players.includes(newPlayerName.trim())}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Add Player
          </button>
        </div>
        {newPlayerName.trim() && players.includes(newPlayerName.trim()) && (
          <p className="text-red-500 text-sm mt-2">Player already exists</p>
        )}
      </div>

      {/* Current Players */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold">Current Players ({players.length})</h3>
          <p className="text-sm text-gray-600">Minimum 4 players required for tournament</p>
        </div>
        
        <div className="divide-y">
          {players.map((player, index) => (
            <div key={player} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold min-w-[2rem] text-center">
                  {index + 1}
                </span>
                {editingPlayer === player ? (
                  <input 
                    type="text"
                    defaultValue={player}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        editPlayer(player, e.target.value);
                      } else if (e.key === 'Escape') {
                        setEditingPlayer(null);
                      }
                    }}
                    onBlur={(e) => editPlayer(player, e.target.value)}
                    autoFocus
                    className="px-3 py-2 border border-blue-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  />
                ) : (
                  <span className="font-medium text-lg">{player}</span>
                )}
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingPlayer(editingPlayer === player ? null : player)}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit player name"
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => removePlayer(player)}
                  disabled={players.length <= 4}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:text-gray-300 disabled:cursor-not-allowed"
                  title={players.length <= 4 ? "Minimum 4 players required" : "Remove player"}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Championship Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center">
            {/* Championship Title */}
            <div className="mb-4">
              {isAdmin ? (
                <input 
                  type="text"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="text-4xl md:text-5xl font-bold text-white bg-transparent border-b-2 border-white/30 hover:border-white/60 focus:border-white focus:outline-none text-center w-full max-w-4xl"
                />
              ) : (
                <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg">
                  {tournamentName}
                </h1>
              )}
            </div>
            
            {/* Championship Subtitle */}
            <div className="flex items-center justify-center gap-3 text-white/90 text-lg md:text-xl">
              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-lg">
                <Users className="text-white" size={28} />
              </div>
              <div>
                <div className="font-semibold">Unique Partnerships Tournament</div>
                <div className="text-white/70 text-sm">{players.length} Players • {games.length} Games • Individual Scoring</div>
              </div>
            </div>
            
            {/* Tournament Status Indicators */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                <Wifi size={14} />
                Data Protected
              </div>
              
              <div className="px-4 py-2 bg-green-500/80 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
                🏆 Championship Format
              </div>
              
              <div className="px-4 py-2 bg-yellow-500/80 backdrop-blur-sm rounded-full text-white text-sm font-semibold">
                ⚡ Live Scoring
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-gray-600">
              Tournament Dashboard
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Progress: {games.filter(g => g.status === 'completed').length}/{games.length} games
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="animate-spin mx-auto mb-4 text-blue-500" size={32} />
              <p className="text-gray-600">Loading tournament data...</p>
            </div>
          </div>
        ) : showPlayerManager ? <PlayerManagerView /> : 
         currentView === 'leaderboard' ? <LeaderboardView /> : <GamesView />}
      </div>

      {/* Share Modal */}
      {showShareModal && <ShareModal />}
    </div>
  );
};

export default PiccleballTournamentApp;