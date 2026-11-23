const db = require("../config/db.js");

const createPollTables = async () => {
    // 1. Polls
    const createPollsQuery = `
        CREATE TABLE IF NOT EXISTS polls (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            creator_id INT NOT NULL,
            question VARCHAR(500) NOT NULL,
            is_multiple_choice BOOLEAN DEFAULT FALSE,
            is_closed BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_poll_conv (conversation_id),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createPollsQuery);

    // 2. Poll Options
    const createOptionsQuery = `
        CREATE TABLE IF NOT EXISTS poll_options (
            id INT AUTO_INCREMENT PRIMARY KEY,
            poll_id INT NOT NULL,
            option_text VARCHAR(255) NOT NULL,
            INDEX idx_opt_poll (poll_id),
            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createOptionsQuery);

    // 3. Poll Votes
    const createVotesQuery = `
        CREATE TABLE IF NOT EXISTS poll_votes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            poll_id INT NOT NULL,
            option_id INT NOT NULL,
            user_id INT NOT NULL,
            voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_poll_user_opt (poll_id, option_id, user_id),
            INDEX idx_vote_poll (poll_id),
            FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
            FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createVotesQuery);

    console.log("Poll tables ready");
};

// Create a new poll with options
const createPoll = async ({ conversationId, creatorId, question, options = [], isMultipleChoice = false }) => {
    const [pollResult] = await db.execute(
        "INSERT INTO polls (conversation_id, creator_id, question, is_multiple_choice) VALUES (?, ?, ?, ?)",
        [conversationId, creatorId, question, isMultipleChoice ? 1 : 0]
    );
    const pollId = pollResult.insertId;

    for (const opt of options) {
        if (typeof opt === 'string' && opt.trim()) {
            await db.execute(
                "INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)",
                [pollId, opt.trim()]
            );
        } else if (opt && opt.option_text && opt.option_text.trim()) {
            await db.execute(
                "INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)",
                [pollId, opt.option_text.trim()]
            );
        }
    }

    return await getPollDetails(pollId, creatorId);
};

// Vote on a poll
const castVote = async ({ pollId, optionId, userId }) => {
    const [pollRows] = await db.execute("SELECT * FROM polls WHERE id = ?", [pollId]);
    if (pollRows.length === 0) throw new Error("Poll not found");
    const poll = pollRows[0];

    if (poll.is_closed) throw new Error("This poll is closed");

    const isMultipleChoice = Boolean(poll.is_multiple_choice);

    // Check if user already voted for this option
    const [existingOptionVote] = await db.execute(
        "SELECT id FROM poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?",
        [pollId, optionId, userId]
    );

    if (existingOptionVote.length > 0) {
        // Toggle vote off
        await db.execute("DELETE FROM poll_votes WHERE id = ?", [existingOptionVote[0].id]);
    } else {
        // If single choice, remove any previous vote by this user on this poll
        if (!isMultipleChoice) {
            await db.execute("DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?", [pollId, userId]);
        }
        // Insert new vote
        await db.execute(
            "INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)",
            [pollId, optionId, userId]
        );
    }

    return await getPollDetails(pollId, userId);
};

// Get complete poll details with vote counts and user status
const getPollDetails = async (pollId, currentUserId = null) => {
    const [polls] = await db.execute(`
        SELECT p.*, u.name AS creator_name, u.username AS creator_username
        FROM polls p
        JOIN users u ON p.creator_id = u.id
        WHERE p.id = ?
    `, [pollId]);
    if (polls.length === 0) return null;

    const poll = polls[0];

    const [options] = await db.execute(
        "SELECT id, option_text FROM poll_options WHERE poll_id = ? ORDER BY id ASC",
        [pollId]
    );

    const [votes] = await db.execute(
        "SELECT option_id, user_id FROM poll_votes WHERE poll_id = ?",
        [pollId]
    );

    const totalVotes = votes.length;
    const userVotes = currentUserId ? votes.filter(v => String(v.user_id) === String(currentUserId)) : [];

    poll.options = options.map(opt => {
        const optionVotes = votes.filter(v => v.option_id === opt.id);
        const hasVoted = currentUserId ? optionVotes.some(v => String(v.user_id) === String(currentUserId)) : false;
        const percentage = totalVotes > 0 ? Math.round((optionVotes.length / totalVotes) * 100) : 0;
        return {
            id: opt.id,
            option_id: opt.id,
            option_text: opt.option_text,
            text: opt.option_text,
            vote_count: optionVotes.length,
            voteCount: optionVotes.length,
            percentage,
            user_voted: hasVoted,
            hasVoted
        };
    });

    poll.total_votes = totalVotes;
    poll.totalVotes = totalVotes;
    poll.user_voted = userVotes.length > 0;
    poll.user_has_voted = userVotes.length > 0;
    poll.hasVoted = userVotes.length > 0;
    return poll;
};

module.exports = {
    createPollTables,
    createPoll,
    castVote,
    getPollDetails
};
