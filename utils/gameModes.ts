import { Team, Fixture, MatchResult, LeagueTableRow, Tournament, TournamentNode } from '../types';

/**
 * İki YZ takım arasındaki tek bir maçı simüle eder.
 * @returns Rastgele skorlar içeren bir MatchResult nesnesi.
 */
export const simulateMatch = (): MatchResult => {
    return {
        team1Score: Math.floor(Math.random() * 5),
        team2Score: Math.floor(Math.random() * 5),
    };
};

/**
 * Bir lig için çift devreli bir fikstür listesi oluşturur.
 * Her takım diğer her takımla hem evinde hem de deplasmanda oynar.
 */
export const generateFixtures = (teams: Team[]): Fixture[] => {
    const fixtures: Fixture[] = [];
    if (teams.length < 2) return [];

    const scheduleTeams = [...teams];

    if (scheduleTeams.length % 2 !== 0) {
        scheduleTeams.push({ name: 'BAY', abbr: 'BAY', color1: '', color2: '' });
    }

    const numRounds = scheduleTeams.length - 1;
    const numMatchesPerRound = scheduleTeams.length / 2;
    const firstHalfFixtures: Fixture[] = [];

    for (let round = 0; round < numRounds; round++) {
        for (let match = 0; match < numMatchesPerRound; match++) {
            const team1 = scheduleTeams[match];
            const team2 = scheduleTeams[scheduleTeams.length - 1 - match];
            
            if (team1.name !== 'BAY' && team2.name !== 'BAY') {
                if (match % 2 === 0) {
                    firstHalfFixtures.push({ round: round + 1, team1, team2 });
                } else {
                    firstHalfFixtures.push({ round: round + 1, team1: team2, team2: team1 });
                }
            }
        }

        const lastTeam = scheduleTeams.pop();
        if(lastTeam) {
            scheduleTeams.splice(1, 0, lastTeam);
        }
    }

    const secondHalfFixtures: Fixture[] = firstHalfFixtures.map(f => ({
        round: f.round + numRounds,
        team1: f.team2, // Ev sahibi ve deplasman takımlarını değiştir
        team2: f.team1,
    }));

    return [...firstHalfFixtures, ...secondHalfFixtures];
};

/**
 * Takım listesi ve tamamlanmış fikstürlerden lig tablosunu hesaplar.
 */
export const calculateLeagueTable = (teams: Team[], fixtures: Fixture[]): LeagueTableRow[] => {
    const tableData: { [key: string]: LeagueTableRow } = teams.reduce((acc, team) => {
        acc[team.abbr] = {
            team,
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
        };
        return acc;
    }, {} as { [key: string]: LeagueTableRow });

    fixtures.forEach(fixture => {
        if (!fixture.result) return;

        const team1Stats = tableData[fixture.team1.abbr];
        const team2Stats = tableData[fixture.team2.abbr];
        const { team1Score, team2Score } = fixture.result;

        if (!team1Stats || !team2Stats) return;

        team1Stats.played++;
        team2Stats.played++;
        team1Stats.goalsFor += team1Score;
        team2Stats.goalsFor += team2Score;
        team1Stats.goalsAgainst += team2Score;
        team2Stats.goalsAgainst += team1Score;

        if (team1Score > team2Score) {
            team1Stats.won++;
            team1Stats.points += 3;
            team2Stats.lost++;
        } else if (team2Score > team1Score) {
            team2Stats.won++;
            team2Stats.points += 3;
            team1Stats.lost++;
        } else {
            team1Stats.drawn++;
            team2Stats.drawn++;
            team1Stats.points++;
            team2Stats.points++;
        }
    });

    const tableArray = Object.values(tableData);
    tableArray.forEach(row => {
        row.goalDifference = row.goalsFor - row.goalsAgainst;
    });

    tableArray.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference;
        if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
        return a.team.name.localeCompare(b.team.name);
    });

    return tableArray;
};

/**
 * 8 takımlı bir eleme usulü turnuva fikstürü oluşturur.
 */
export const generateTournamentBracket = (teams: Team[], playerTeam: Team): Tournament => {
    const otherTeams = teams.filter(t => t.abbr !== playerTeam.abbr);
    const shuffledOthers = [...otherTeams].sort(() => 0.5 - Math.random());
    const tournamentTeams = [playerTeam, ...shuffledOthers.slice(0, 7)];
    const finalShuffled = tournamentTeams.sort(() => 0.5 - Math.random());

    const quarterFinals: TournamentNode[] = [];
    for (let i = 0; i < 8; i += 2) {
        quarterFinals.push({
            team1: finalShuffled[i],
            team2: finalShuffled[i+1],
            matchId: i / 2,
        });
    }
    
    const semiFinals: TournamentNode[] = [
        { matchId: 4 }, { matchId: 5 }
    ];
    
    const final: TournamentNode[] = [
        { matchId: 6 }
    ];
    
    return {
        playerTeam,
        rounds: [quarterFinals, semiFinals, final],
        currentRound: 0,
    }
};