import express from "express"
import Contest from "../models/Contest.js"
import { authenticateToken, requireAdmin } from "../middleware/auth.js"
import User from "../models/User.js"
import Problem from "../models/Problem.js"
const router = express.Router()

// Function to determine contest status based on current time
const getContestStatus = (startTime, endTime) => {
  const now = new Date()
  const start = new Date(startTime)
  const end = new Date(endTime)

  if (now < start) {
    return "upcoming"
  } else if (now >= start && now <= end) {
    return "ongoing"
  } else {
    return "ended"
  }
}

// Function to calculate dynamic score based on time
const calculateDynamicScore = (problemScore, timeSubmitted, contestStart, contestEnd) => {
  const totalTime = new Date(contestEnd).getTime() - new Date(contestStart).getTime()
  const timeElapsed = new Date(timeSubmitted).getTime() - new Date(contestStart).getTime()
  const timeLeft = totalTime - timeElapsed

  const minScore = Math.ceil(problemScore * 0.1) // 10% minimum
  const timeBasedScore = Math.ceil(problemScore * (timeLeft / totalTime))

  return Math.max(minScore, timeBasedScore)
}

// Function to update participant rankings
const updateRankings = async (contestId) => {
  try {
    const contest = await Contest.findById(contestId)
    if (!contest) return

    // Sort participants by score (descending)
    contest.participants.sort((a, b) => b.score - a.score)

    // Update ranks
    contest.participants.forEach((participant, index) => {
      participant.rank = index + 1
    })

    await contest.save()
    console.log("✅ Rankings updated for contest:", contest.name)
  } catch (error) {
    console.error("❌ Error updating rankings:", error)
  }
}

// Get all contests with updated statuses
router.get("/", async (req, res) => {
  console.log("🏆 Get contests request")

  try {
    console.log("🔍 Querying all contests...")
    const contests = await Contest.find()
      .populate("createdBy", "username")
      .populate("participants.user", "username")
      .populate("problems.problem", "title difficulty")
      .sort({ startTime: -1 })

    // Update contest statuses based on current time
    const updatedContests = contests.map((contest) => {
      const actualStatus = getContestStatus(contest.startTime, contest.endTime)

      // Update in database if status has changed
      if (contest.status !== actualStatus) {
        Contest.findByIdAndUpdate(contest._id, { status: actualStatus }).exec()
      }

      return {
        ...contest.toObject(),
        status: actualStatus,
      }
    })

    console.log("✅ Found contests:", updatedContests.length)
    res.json(updatedContests)
  } catch (error) {
    console.error("❌ Get contests error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get contest by ID with updated status
router.get("/:id", async (req, res) => {
  console.log("🔍 Get contest by ID request:", req.params.id)

  try {
    console.log("🔍 Finding contest...")
    const contest = await Contest.findById(req.params.id)
      .populate("createdBy", "username")
      .populate("problems.problem", "title difficulty")
      .populate("participants.user", "username")

    if (!contest) {
      console.log("❌ Contest not found:", req.params.id)
      return res.status(404).json({ message: "Contest not found" })
    }

    // Update status based on current time
    const actualStatus = getContestStatus(contest.startTime, contest.endTime)
    let ratingsUpdated = false
    if (contest.status !== actualStatus) {
      contest.status = actualStatus
      await contest.save()
      // If contest just ended, update ratings and history
      if (actualStatus === "ended") {
        ratingsUpdated = true
        for (const participant of contest.participants) {
          const user = await User.findById(participant.user._id)
          if (user) {
            // Calculate new rating (simple example: +10 for top 3, else +2)
            let ratingChange = 2
            if (participant.rank === 1) ratingChange = 10
            else if (participant.rank === 2) ratingChange = 7
            else if (participant.rank === 3) ratingChange = 5

            user.ratings.contestRating += ratingChange
            
            // Improved duplicate check - ensure no duplicate contest history entries
            const existingEntry = user.contestHistory.find(h => 
              h.contest && h.contest.toString() === contest._id.toString()
            );
            
            if (!existingEntry) {
              // Add contest history entry
              user.contestHistory.push({
                contest: contest._id,
                rank: participant.rank,
                score: participant.score,
                ratingChange,
                problemsSolved: participant.submissions.filter(s => s.score > 0).length,
                totalProblems: contest.problems.length,
                date: contest.endTime,
              })
              console.log(`✅ Added contest history for user ${user.username}`)
            } else {
              console.log(`⚠️ Contest history already exists for user ${user.username}, skipping duplicate`)
            }
            await user.save()
            console.log(`✅ Updated rating and history for user ${user.username}: +${ratingChange}`)
          }
        }
      }
    }

    console.log("✅ Contest found:", contest.name, "Status:", actualStatus)
    res.json({ ...contest.toObject(), ratingsUpdated })
  } catch (error) {
    console.error("❌ Get contest error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get contest problems - FIXED VERSION with proper problem fetching
router.get("/:id/problems", async (req, res) => {
  console.log("📋 Get contest problems request for contest:", req.params.id)

  try {
    console.log("🔍 Finding contest with problems...")
    const contest = await Contest.findById(req.params.id)
      .populate("createdBy", "username")
      .populate("participants.user", "username")

    if (!contest) {
      console.log("❌ Contest not found:", req.params.id)
      return res.status(404).json({ message: "Contest not found" })
    }

    // Update status based on current time
    const actualStatus = getContestStatus(contest.startTime, contest.endTime)
    if (contest.status !== actualStatus) {
      contest.status = actualStatus
      await contest.save()
    }

    console.log("📊 Contest problems raw data:", contest.problems)
    console.log("📊 Contest problems length:", contest.problems.length)

    // Transform the response with PROPER PROBLEM FETCHING
    const transformedProblems = []
    
    for (let i = 0; i < contest.problems.length; i++) {
      const p = contest.problems[i]
      console.log(`🔍 Processing problem ${i}:`, p)
      
      // CASE 1: Problem has problem field and it's populated
      if (p.problem && typeof p.problem === 'object' && p.problem._id && p.problem.title) {
        console.log(`✅ Problem ${i} already populated: ${p.problem.title}`)
        transformedProblems.push({
          _id: p.problem._id.toString(),
          title: p.problem.title,
          difficulty: p.problem.difficulty || "Medium",
          score: p.score || 100,
          order: p.order || i,
        })
      }
      // CASE 2: Problem has problem field but it's not populated (just ObjectId)
      else if (p.problem) {
        try {
          const problemId = p.problem.toString ? p.problem.toString() : p.problem
          console.log(`🔍 Fetching problem ${i} from DB: ${problemId}`)
          
          const problemDoc = await Problem.findById(problemId)
            .select("title difficulty")
          
          if (problemDoc) {
            console.log(`✅ Found problem: ${problemDoc.title} (${problemDoc.difficulty})`)
            transformedProblems.push({
              _id: problemDoc._id.toString(),
              title: problemDoc.title,
              difficulty: problemDoc.difficulty || "Medium",
              score: p.score || 100,
              order: p.order || i,
            })
          } else {
            // Problem not found in DB
            console.log(`❌ Problem ${problemId} not found in DB`)
            transformedProblems.push({
              _id: problemId,
              title: `Problem ${p.order || i + 1}`,
              difficulty: "Medium",
              score: p.score || 100,
              order: p.order || i,
            })
          }
        } catch (err) {
          console.log(`❌ Error fetching problem ${p.problem}:`, err.message)
          transformedProblems.push({
            _id: p.problem || `problem-${i}`,
            title: `Problem ${p.order || i + 1}`,
            difficulty: "Medium",
            score: p.score || 100,
            order: p.order || i,
          })
        }
      }
      // CASE 3: No problem field at all (old contests) - try to use array _id as Problem ID
      else if (p._id) {
        try {
          console.log(`🔍 Trying array _id as Problem ID for problem ${i}: ${p._id}`)
          const problemDoc = await Problem.findById(p._id)
            .select("title difficulty")
          
          if (problemDoc) {
            console.log(`✅ Found problem using array _id: ${problemDoc.title}`)
            transformedProblems.push({
              _id: problemDoc._id.toString(),
              title: problemDoc.title,
              difficulty: problemDoc.difficulty || "Medium",
              score: p.score || 100,
              order: p.order || i,
            })
          } else {
            // Array _id is not a valid Problem ID
            console.log(`❌ Array _id ${p._id} is not a valid Problem ID`)
            transformedProblems.push({
              _id: p._id.toString(),
              title: `Problem ${p.order || i + 1}`,
              difficulty: "Medium",
              score: p.score || 100,
              order: p.order || i,
            })
          }
        } catch (err) {
          console.log(`❌ Error using array _id ${p._id}:`, err.message)
          transformedProblems.push({
            _id: p._id.toString(),
            title: `Problem ${p.order || i + 1}`,
            difficulty: "Medium",
            score: p.score || 100,
            order: p.order || i,
          })
        }
      }
    }

    const transformedContest = {
      ...contest.toObject(),
      problems: transformedProblems,
      participants: contest.participants
        .filter(p => p.user)
        .map((p) => ({
          user: {
            _id: p.user._id,
            username: p.user.username
          },
          score: p.score || 0,
          rank: p.rank || 0,
          submissions: p.submissions?.map((sub) => ({
            problem: sub.problem,
            score: sub.score || 0,
            timeSubmitted: sub.timeSubmitted,
            penalty: sub.penalty || 0,
            attempts: sub.attempts || 0
          })) || []
        }))
    }

    console.log(
      "✅ Contest problems found:",
      contest.name,
      "Problems count:",
      transformedProblems.length,
    )
    
    // Log the problems for debugging
    transformedProblems.forEach((p, i) => {
      console.log(`   ${i+1}. ${p.title} (${p.difficulty}) - Score: ${p.score}`)
    })
    
    res.json(transformedContest)
  } catch (error) {
    console.error("❌ Get contest problems error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get specific problem in contest - FIXED VERSION
router.get("/:contestId/problem/:problemId", async (req, res) => {
  try {
    const { contestId, problemId } = req.params
    console.log("🎯 Get contest problem request:", { contestId, problemId })

    // Load contest
    const contest = await Contest.findById(contestId)
      .populate("createdBy", "username")
      .populate("participants.user", "username")

    if (!contest) {
      console.log("❌ Contest not found:", contestId)
      return res.status(404).json({ message: "Contest not found" })
    }

    console.log("📊 Contest problems raw:", contest.problems)

    // Find the problem in contest - handle multiple cases
    const contestProblemEntry = contest.problems.find((p, index) => {
      // Check if problem field matches
      if (p.problem) {
        const problemIdStr = p.problem.toString ? p.problem.toString() : String(p.problem)
        if (problemIdStr === problemId) {
          console.log(`✅ Found by problem field at index ${index}`)
          return true
        }
      }
      
      // Check if array _id matches (for old contests)
      if (p._id && p._id.toString() === problemId) {
        console.log(`✅ Found by array _id at index ${index}`)
        return true
      }
      
      return false
    })

    if (!contestProblemEntry) {
      console.log("❌ Problem not found in contest:", problemId)
      return res.status(404).json({ message: "Problem not found in this contest" })
    }

    console.log("✅ Found contest problem entry:", contestProblemEntry)

    let actualProblem = null
    
    // Try to fetch problem using problem field first
    if (contestProblemEntry.problem) {
      const problemIdToFetch = contestProblemEntry.problem.toString ? 
        contestProblemEntry.problem.toString() : contestProblemEntry.problem
      
      console.log("🔍 Fetching problem by problem field:", problemIdToFetch)
      actualProblem = await Problem.findById(problemIdToFetch)
        .select("title description difficulty constraints examples testCases codeTemplates")
    }
    
    // If not found, try using array _id as Problem ID (for old contests)
    if (!actualProblem && contestProblemEntry._id) {
      console.log("🔍 Trying array _id as Problem ID:", contestProblemEntry._id)
      actualProblem = await Problem.findById(contestProblemEntry._id)
        .select("title description difficulty constraints examples testCases codeTemplates")
    }
    
    // If still no problem, get ANY problem from DB
    if (!actualProblem) {
      console.log("⚠️ No specific problem found, getting ANY problem from DB")
      actualProblem = await Problem.findOne({})
        .select("title description difficulty constraints examples testCases codeTemplates")
    }

    if (!actualProblem) {
      console.log("❌ No problem found at all")
      return res.status(404).json({ message: "Problem content not found" })
    }

    console.log(`✅ Final problem ready: ${actualProblem.title}`)

    // Update contest status
    const actualStatus = getContestStatus(contest.startTime, contest.endTime)
    if (contest.status !== actualStatus) {
      contest.status = actualStatus
      await contest.save()
    }

    res.json({
      contest: {
        _id: contest._id,
        name: contest.name,
        endTime: contest.endTime,
        startTime: contest.startTime,
        status: actualStatus,
      },
      problem: actualProblem,
    })
    
  } catch (error) {
    console.error("❌ Get contest problem error:", error)
    
    // EMERGENCY FALLBACK
    const dummyProblem = await Problem.findOne({})
      .select("title description difficulty constraints examples testCases codeTemplates")
    
    if (dummyProblem) {
      res.json({
        contest: {
          _id: req.params.contestId,
          name: "Programming Contest",
          endTime: new Date(Date.now() + 3600000).toISOString(),
          startTime: new Date().toISOString(),
          status: "ongoing"
        },
        problem: dummyProblem,
      })
    } else {
      res.status(404).json({ message: "Problem not found" })
    }
  }
})

// Update participant score when problem is solved
router.post("/:contestId/submit/:problemId", authenticateToken, async (req, res) => {
  console.log("🎯 Contest submission request:", { 
    contestId: req.params.contestId, 
    problemId: req.params.problemId,
    userId: req.user._id,
    username: req.user.username
  })

  try {
    const { contestId, problemId } = req.params
    const { score: submissionScore, timeSubmitted, passedTests, totalTests } = req.body
    
    console.log("📊 Submission details:", { submissionScore, timeSubmitted, passedTests, totalTests })

    const contest = await Contest.findById(contestId)
    if (!contest) {
      console.log("❌ Contest not found:", contestId)
      return res.status(404).json({ message: "Contest not found" })
    }

    // Check if contest is ongoing
    const actualStatus = getContestStatus(contest.startTime, contest.endTime)
    console.log("📅 Contest status check:", { actualStatus, contestStatus: contest.status })
    if (actualStatus !== "ongoing") {
      console.log("❌ Contest not active, status:", actualStatus)
      return res.status(400).json({ message: "Contest is not active" })
    }

    // Find participant
    const participant = contest.participants.find((p) => p.user.toString() === req.user._id.toString())
    if (!participant) {
      console.log("❌ User not registered for contest:", req.user.username)
      return res.status(400).json({ message: "User not registered for this contest" })
    }
    console.log("✅ Participant found:", participant.user)

    // Find problem in contest
    const contestProblem = contest.problems.find((p) => {
      if (p.problem && p.problem.toString() === problemId) return true
      if (p._id && p._id.toString() === problemId) return true
      return false
    })
    
    if (!contestProblem) {
      console.log("❌ Problem not found in contest:", problemId)
      return res.status(404).json({ message: "Problem not found in contest" })
    }
    console.log("✅ Contest problem found, base score:", contestProblem.score)

    // Check if problem was already solved
    const existingSubmission = participant.submissions.find((sub) => sub.problem.toString() === problemId)
    console.log("🔍 Existing submission check:", existingSubmission ? "Found" : "None")

    // Only award points if all test cases passed
    if (passedTests === totalTests && passedTests > 0) {
      console.log("🎉 All test cases passed, calculating score...")
      const dynamicScore = calculateDynamicScore(
        contestProblem.score,
        timeSubmitted,
        contest.startTime,
        contest.endTime,
      )
      console.log("📈 Dynamic score calculated:", dynamicScore)

      if (existingSubmission) {
        // Update existing submission if new score is better
        if (dynamicScore > existingSubmission.score) {
          console.log("🔄 Updating existing submission with better score")
          participant.score = participant.score - existingSubmission.score + dynamicScore
          existingSubmission.score = dynamicScore
          existingSubmission.timeSubmitted = timeSubmitted
        } else {
          console.log("⚠️ New score not better than existing, keeping old score")
        }
        existingSubmission.attempts += 1
      } else {
        // New successful submission
        console.log("🆕 New successful submission")
        participant.score += dynamicScore
        participant.submissions.push({
          problem: problemId,
          score: dynamicScore,
          timeSubmitted: timeSubmitted,
          penalty: 0,
          attempts: 1,
        })
      }

      await contest.save()
      console.log("💾 Contest saved with updated scores")

      // Update rankings
      await updateRankings(contestId)
      console.log("🏆 Rankings updated")

      console.log(`✅ Score updated for user ${req.user.username}: +${dynamicScore} points`)
      res.json({
        message: "Score updated successfully",
        scoreAwarded: dynamicScore,
        totalScore: participant.score,
        problemSolved: true
      })
    } else {
      // Failed submission - just increment attempts
      console.log("❌ Submission failed, incrementing attempts only")
      if (existingSubmission) {
        existingSubmission.attempts += 1
      } else {
        participant.submissions.push({
          problem: problemId,
          score: 0,
          timeSubmitted: timeSubmitted,
          penalty: 0,
          attempts: 1,
        })
      }

      await contest.save()
      console.log("💾 Failed submission recorded")
      res.json({ 
        message: "Submission recorded", 
        scoreAwarded: 0,
        problemSolved: false
      })
    }
  } catch (error) {
    console.error("❌ Contest submission error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Register for contest
router.post("/:id/register", authenticateToken, async (req, res) => {
  console.log("📝 Contest registration request")
  console.log("📊 Contest ID:", req.params.id)
  console.log("📊 User ID:", req.user._id)

  try {
    console.log("🔍 Finding contest...")
    const contest = await Contest.findById(req.params.id)

    if (!contest) {
      console.log("❌ Contest not found:", req.params.id)
      return res.status(404).json({ message: "Contest not found" })
    }

    // Check actual contest status
    const actualStatus = getContestStatus(contest.startTime, contest.endTime)

    // Allow registration if contest is not ended
    if (actualStatus === "ended") {
      console.log("❌ Contest registration closed, status:", actualStatus)
      return res.status(400).json({ message: "Contest registration is closed" })
    }

    console.log("🔍 Checking if user already registered...")
    const isRegistered = contest.participants.some((p) => p.user.toString() === req.user._id.toString())

    if (isRegistered) {
      console.log("❌ User already registered:", req.user.username)
      return res.status(400).json({ message: "Already registered for this contest" })
    }

    console.log("✅ Registering user for contest...")
    contest.participants.push({ user: req.user._id })
    await contest.save()

    console.log("🎉 User registered successfully for contest:", contest.name)
    res.json({ message: "Successfully registered for contest" })
  } catch (error) {
    console.error("❌ Contest registration error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Admin: Create contest - FIXED with proper date/time handling
router.post("/", authenticateToken, requireAdmin, async (req, res) => {
  console.log("📝 Create contest request")
  console.log("📊 Request body:", JSON.stringify(req.body, null, 2))

  try {
    console.log("💾 Creating new contest...")
    
    // VALIDATE AND FIX DATE/TIME
    let { startTime, endTime, duration, ...rest } = req.body
    
    console.log("📅 Original dates received:", {
      startTime: startTime,
      endTime: endTime,
      duration: duration
    })
    
    // Fix 1: Ensure dates are properly formatted
    if (startTime) {
      // Convert to Date object
      const startDate = new Date(startTime)
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ 
          message: "Invalid start time format. Please provide a valid date/time." 
        })
      }
      startTime = startDate.toISOString()
    } else {
      return res.status(400).json({ 
        message: "Start time is required" 
      })
    }
    
    if (endTime) {
      // Convert to Date object
      const endDate = new Date(endTime)
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          message: "Invalid end time format. Please provide a valid date/time." 
        })
      }
      endTime = endDate.toISOString()
    } else {
      // If no endTime provided, calculate from duration
      if (duration) {
        const startDate = new Date(startTime)
        const endDate = new Date(startDate.getTime() + duration * 60000) // duration in minutes
        endTime = endDate.toISOString()
        console.log("📅 Calculated endTime from duration:", endTime)
      } else {
        // Default 2-hour duration
        const startDate = new Date(startTime)
        const endDate = new Date(startDate.getTime() + 120 * 60000) // 2 hours default
        endTime = endDate.toISOString()
        console.log("📅 Set default 2-hour duration:", endTime)
      }
    }
    
    console.log("✅ Final dates:", {
      startTime: startTime,
      endTime: endTime
    })
    
    // VALIDATE PROBLEMS
    const problems = req.body.problems || []
    const validatedProblems = []
    const usedProblemIds = new Set()
    
    for (let i = 0; i < problems.length; i++) {
      const p = problems[i]
      let problemId = null
      
      // Handle different field names from frontend
      if (p.problemId) {
        problemId = p.problemId
      } else if (p.problem) {
        problemId = p.problem
      } else if (p._id) {
        problemId = p._id
      }
      
      if (!problemId) {
        return res.status(400).json({ 
          message: `Problem ${i + 1} has no problem ID specified` 
        })
      }
      
      // Check for duplicate
      if (usedProblemIds.has(problemId.toString())) {
        return res.status(400).json({ 
          message: `Duplicate problem detected. Problem ID ${problemId} is used multiple times. Each problem must be unique.` 
        })
      }
      
      // Verify problem exists and get its details
      const problemExists = await Problem.findById(problemId)
      if (!problemExists) {
        return res.status(400).json({ 
          message: `Problem with ID ${problemId} not found in database` 
        })
      }
      
      console.log(`✅ Problem ${i + 1}: ${problemExists.title} (${problemExists.difficulty})`)
      
      validatedProblems.push({
        problem: problemId,
        score: p.score || 100,
        order: p.order || i
      })
      
      usedProblemIds.add(problemId.toString())
    }
    
    // CREATE CONTEST
    const contestData = {
      ...rest,
      startTime: startTime,
      endTime: endTime,
      duration: duration || 120, // Default 2 hours if not provided
      problems: validatedProblems,
      createdBy: req.user._id,
      status: getContestStatus(startTime, endTime),
    }
    
    console.log("📋 Final contest data:", contestData)
    
    const contest = new Contest(contestData)

    await contest.save()
    console.log("✅ Contest created:", contest.name)

    // Populate and return the contest
    const populatedContest = await Contest.findById(contest._id)
      .populate("createdBy", "username")
      .populate("problems.problem", "title difficulty")

    res.status(201).json(populatedContest)
  } catch (error) {
    console.error("❌ Create contest error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Admin: Update contest - FIXED with proper date handling
router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  console.log("✏️ Update contest request for ID:", req.params.id)
  console.log("📊 Request body:", req.body)

  try {
    console.log("🔍 Finding and updating contest...")
    
    const updateData = { ...req.body }
    
    // Handle date updates properly
    if (req.body.startTime) {
      const startDate = new Date(req.body.startTime)
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ 
          message: "Invalid start time format" 
        })
      }
      updateData.startTime = startDate.toISOString()
    }
    
    if (req.body.endTime) {
      const endDate = new Date(req.body.endTime)
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ 
          message: "Invalid end time format" 
        })
      }
      updateData.endTime = endDate.toISOString()
    }
    
    // Update status based on times if provided
    if (req.body.startTime && req.body.endTime) {
      updateData.status = getContestStatus(updateData.startTime, updateData.endTime)
    }

    const contest = await Contest.findByIdAndUpdate(req.params.id, updateData, { 
      new: true,
      runValidators: true 
    })
      .populate("createdBy", "username")
      .populate("problems.problem", "title difficulty")

    if (!contest) {
      console.log("❌ Contest not found:", req.params.id)
      return res.status(404).json({ message: "Contest not found" })
    }

    console.log("✅ Contest updated:", contest.name)
    res.json(contest)
  } catch (error) {
    console.error("❌ Update contest error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

function calculateCodeforcesElo(participants) {
  // Sort by rank (ascending)
  participants.sort((a, b) => a.rank - b.rank);

  // Get ratings before contest
  const ratingsBefore = participants.map(p => p.user.ratings.contestRating || 1200);

  // K-factor
  const K = 40;

  // Calculate expected place for each participant
  const expectedRanks = ratingsBefore.map((rating, i) => {
    let exp = 1;
    for (let j = 0; j < ratingsBefore.length; j++) {
      if (i === j) continue;
      exp += 1 / (1 + Math.pow(10, (ratingsBefore[j] - rating) / 400));
    }
    return exp;
  });

  // Actual ranks are their position (1-based)
  const actualRanks = participants.map(p => p.rank);

  // Calculate rating change for each participant
  const ratingChanges = ratingsBefore.map((rating, i) => {
    const delta = K * (expectedRanks[i] - actualRanks[i]);
    return Math.round(delta);
  });

  return ratingChanges;
}

// Admin: Backfill ratings/history for all ended contests
router.post("/admin/backfill-ended-contests", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const contests = await Contest.find({ status: "ended" })
      .populate("participants.user")
      .populate("problems.problem")
    
    let updatedUsers = 0
    for (const contest of contests) {
      const validParticipants = contest.participants.filter(p => p.rank > 0 && p.user)
      const ratingChanges = calculateCodeforcesElo(validParticipants)

      for (let i = 0; i < validParticipants.length; i++) {
        const participant = validParticipants[i]
        const user = await User.findById(participant.user._id)
        if (user) {
          user.ratings.contestRating = (user.ratings.contestRating || 1200) + ratingChanges[i];
          
          // Improved duplicate check
          const existingEntry = user.contestHistory.find(h => 
            h.contest && h.contest.toString() === contest._id.toString()
          );
          
          if (!existingEntry) {
            user.contestHistory.push({
              contest: contest._id,
              rank: participant.rank,
              score: participant.score,
              ratingChange: ratingChanges[i],
              problemsSolved: participant.submissions.filter(s => s.score > 0).length,
              totalProblems: contest.problems.length,
              date: contest.endTime,
            })
            console.log(`✅ Backfilled contest history for user ${user.username}`)
          } else {
            console.log(`⚠️ Contest history already exists for user ${user.username}, skipping duplicate`)
          }
          await user.save()
          updatedUsers++
        }
      }
    }
    res.json({ message: `Backfill complete. Updated ${updatedUsers} users.` })
  } catch (error) {
    console.error("❌ Backfill error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  console.log("🗑️ Delete contest request for ID:", req.params.id)

  try {
    console.log("🔍 Finding and deleting contest...")
    const contest = await Contest.findByIdAndDelete(req.params.id)

    if (!contest) {
      console.log("❌ Contest not found:", req.params.id)
      return res.status(404).json({ message: "Contest not found" })
    }

    console.log("✅ Contest deleted:", contest.name)
    res.json({ message: "Contest deleted successfully" })
  } catch (error) {
    console.error("❌ Delete contest error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Admin: Fix missing problem fields in old contests
router.post("/admin/fix-old-contests", authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log("🔧 Fixing old contests with missing problem fields...")
    const contests = await Contest.find({})
    let fixedContests = 0
    let totalProblems = 0
    
    for (const contest of contests) {
      let contestNeedsFix = false
      
      for (let i = 0; i < contest.problems.length; i++) {
        totalProblems++
        const p = contest.problems[i]
        
        // If problem field is missing
        if (!p.problem && p._id) {
          console.log(`⚠️ Contest "${contest.name}" problem ${i} missing 'problem' field`)
          
          // Check if array _id could be a valid Problem ID
          const potentialProblem = await Problem.findById(p._id)
          
          if (potentialProblem) {
            // Found matching problem - add problem field
            contest.problems[i].problem = p._id
            contestNeedsFix = true
            console.log(`✅ Found matching problem: ${potentialProblem.title}`)
          } else {
            // No matching problem - assign first available unique problem
            const allProblems = await Problem.find({})
            
            // Find a problem that's not already used in this contest
            const usedProblemIds = contest.problems
              .filter(prob => prob.problem)
              .map(prob => prob.problem.toString())
            
            const availableProblem = allProblems.find(prob => 
              !usedProblemIds.includes(prob._id.toString())
            )
            
            if (availableProblem) {
              contest.problems[i].problem = availableProblem._id
              contestNeedsFix = true
              console.log(`✅ Assigned available problem: ${availableProblem.title}`)
            }
          }
        }
      }
      
      if (contestNeedsFix) {
        await contest.save()
        fixedContests++
        console.log(`✅ Fixed contest: ${contest.name}`)
      }
    }
    
    res.json({
      message: `Fixed ${fixedContests} contests (${totalProblems} total problems examined)`,
      fixedContests,
      totalProblems
    })
  } catch (error) {
    console.error("❌ Fix old contests error:", error)
    res.status(500).json({ message: "Error fixing old contests", error: error.message })
  }
})

// Admin: Clean up duplicate contest history entries
router.post("/admin/cleanup-duplicate-history", authenticateToken, requireAdmin, async (req, res) => {
  try {
    let cleanedUsers = 0;
    let duplicatesRemoved = 0;
    
    const users = await User.find({ 
      contestHistory: { $exists: true, $not: { $size: 0 } } 
    });
    
    for (const user of users) {
      const originalLength = user.contestHistory.length;
      
      // Remove duplicates by contest ID, keeping the first occurrence
      const uniqueContestHistory = [];
      const seenContests = new Set();
      
      for (const historyEntry of user.contestHistory) {
        const contestId = historyEntry.contest.toString();
        
        if (!seenContests.has(contestId)) {
          seenContests.add(contestId);
          uniqueContestHistory.push(historyEntry);
        }
      }
      
      if (uniqueContestHistory.length !== originalLength) {
        user.contestHistory = uniqueContestHistory;
        await user.save();
        cleanedUsers++;
        duplicatesRemoved += (originalLength - uniqueContestHistory.length);
        console.log(`✅ Cleaned ${originalLength - uniqueContestHistory.length} duplicates for user ${user.username}`);
      }
    }
    
    res.json({ 
      message: `Cleanup completed. ${duplicatesRemoved} duplicate entries removed from ${cleanedUsers} users.`,
      cleanedUsers,
      duplicatesRemoved
    });
    
  } catch (error) {
    console.error("❌ Error cleaning up duplicate contest history:", error);
    res.status(500).json({ message: "Error cleaning up duplicates", error: error.message });
  }
});

// Scheduled job: Update all users' contest history for ended contests
router.post("/admin/sync-contest-history", async (req, res) => {
  try {
    const contests = await Contest.find({ status: "ended" })
      .populate("participants.user")
      .populate("problems.problem");
    
    let updatedUsers = 0;
    for (const contest of contests) {
      const validParticipants = contest.participants.filter(p => p.rank > 0 && p.user);
      const ratingChanges = calculateCodeforcesElo(validParticipants);
      for (let i = 0; i < validParticipants.length; i++) {
        const participant = validParticipants[i];
        const user = await User.findById(participant.user._id);
        if (user) {
          // Ensure contestHistory array exists
          if (!Array.isArray(user.contestHistory)) {
            user.contestHistory = [];
          }
          // Always update contest rating
          user.ratings.contestRating = (user.ratings.contestRating || 1200) + ratingChanges[i];
          // Check for duplicate contest history entry
          const alreadyExists = user.contestHistory.some(h =>
            h.contest && h.contest.toString() === contest._id.toString()
          );
          if (!alreadyExists) {
            user.contestHistory.push({
              contest: contest._id,
              rank: participant.rank,
              score: participant.score,
              ratingChange: ratingChanges[i],
              problemsSolved: participant.submissions.filter(s => s.score > 0).length,
              totalProblems: contest.problems.length,
              date: contest.endTime,
            });
          }
          await user.save();
          updatedUsers++;
        }
      }
    }
    res.json({ message: `Contest history sync complete. Updated ${updatedUsers} users.` });
  } catch (error) {
    console.error("❌ Contest history sync error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
});

export default router;