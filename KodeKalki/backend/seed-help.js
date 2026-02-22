import "./loadenv.js";
import mongoose from "mongoose";
import Help from "./models/Help.js";

const sampleArticles = [
  // Getting Started
  {
    title: "Getting Started with Kodekalki",
    slug: "getting-started",
    content: `
      <h2>Welcome to Kodekalki! 🎉</h2>
      <p>Kodekalki is your ultimate competitive programming platform. Master coding through practice, contests, and daily challenges.</p>
    
      <h3>Quick Start Guide</h3>
      <ol>
        <li><strong>Create Your Account</strong> - Sign up in seconds</li>
        <li><strong>Solve Your First Problem</strong> - Start with Easy difficulty</li>
        <li><strong>Join a Contest</strong> - Test your skills against others</li>
        <li><strong>Build Your Streak</strong> - Solve daily problems</li>
      </ol>
    
      <h3>Key Features</h3>
      <ul>
        <li>📝 <strong>1000+ Problems</strong> - From beginner to expert</li>
        <li>🏆 <strong>Weekly Contests</strong> - Compete and improve your rating</li>
        <li>⚡ <strong>Rapid Fire Mode</strong> - Quick coding challenges</li>
        <li>📅 <strong>Problem of the Day</strong> - Daily practice to maintain streaks</li>
        <li>📊 <strong>Detailed Analytics</strong> - Track your progress</li>
      </ul>
    
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1.5rem; border-radius: 0.75rem; color: white; margin: 1.5rem 0;">
        <h4 style="margin-top: 0; color: white;">💡 Pro Tip</h4>
        <p style="margin-bottom: 0;">Start with the "Problem of the Day" to build a consistent coding habit. A 7-day streak unlocks exclusive badges!</p>
      </div>
    `,
    category: "getting-started",
    tags: ["tutorial", "beginner", "introduction", "quickstart"],
    order: 1,
    isPublished: true,
  },
  {
    title: "How to Create Your Account",
    slug: "create-account",
    content: `
      <h2>Sign Up in 3 Easy Steps</h2>
    
      <div style="display: grid; gap: 1.5rem; margin: 2rem 0;">
        <div style="padding: 1.5rem; background: #f8f9fa; border-radius: 0.5rem; border-left: 4px solid #6366f1;">
          <h3 style="margin-top: 0; color: #6366f1;">Step 1: Fill Registration Form</h3>
          <ul>
            <li><strong>Username:</strong> Choose a unique username (3-20 characters)</li>
            <li><strong>Email:</strong> Use a valid email address</li>
            <li><strong>Password:</strong> Minimum 8 characters, include numbers and symbols</li>
          </ul>
        </div>
      
        <div style="padding: 1.5rem; background: #f8f9fa; border-radius: 0.5rem; border-left: 4px solid #10b981;">
          <h3 style="margin-top: 0; color: #10b981;">Step 2: Verify Your Email</h3>
          <p>Check your inbox for a verification email. Click the verification link to activate your account.</p>
          <p><em>Tip: Check spam folder if you don't see it within 5 minutes.</em></p>
        </div>
      
        <div style="padding: 1.5rem; background: #f8f9fa; border-radius: 0.5rem; border-left: 4px solid #6366f1;">
          <h3 style="margin-top: 0; color: #6366f1;">Step 3: Complete Your Profile</h3>
          <p>Add your programming interests, skill level, and goals to personalize your experience.</p>
        </div>
      </div>
    
      <h3>Security Best Practices</h3>
      <ul>
        <li>✅ Use a strong, unique password</li>
        <li>✅ Enable two-factor authentication (2FA)</li>
        <li>✅ Never share your password</li>
        <li>✅ Log out from shared devices</li>
      </ul>
    `,
    category: "getting-started",
    tags: ["account", "registration", "signup", "security"],
    order: 2,
    isPublished: true,
  },
  // Problems
  {
    title: "How to Submit Solutions",
    slug: "submit-solutions",
    content: `
      <h2>Submitting Your Code</h2>
    
      <h3>Choose Your Language</h3>
      <p>We support multiple programming languages:</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 1rem 0;">
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; text-align: center; color: white;">
          <strong>Python 3</strong><br/>🐍
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; text-align: center; color: white;">
          <strong>JavaScript</strong><br/>⚡
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; text-align: center; color: white;">
          <strong>Java</strong><br/>☕
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; text-align: center; color: white;">
          <strong>C++</strong><br/>⚙️
        </div>
      </div>
    
      <h3>Writing Code</h3>
      <p>Our editor features:</p>
      <ul>
        <li>✨ Syntax highlighting</li>
        <li>🔤 Auto-completion</li>
        <li>🎨 Multiple themes (light/dark)</li>
        <li>⌨️ Keyboard shortcuts</li>
        <li>📱 Mobile-friendly interface</li>
      </ul>
    
      <h3>Test Before Submit</h3>
      <p>Always test your code with sample inputs:</p>
      <ol>
        <li>Click the <strong>"Run Code"</strong> button</li>
        <li>Check output against expected results</li>
        <li>Debug if needed</li>
        <li>Submit when confident</li>
      </ol>
    
      <h3>Understanding Verdicts</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0;">
        <tr style="background: #f3f4f6;">
          <th style="padding: 0.75rem; text-align: left; border: 1px solid #e5e7eb;">Verdict</th>
          <th style="padding: 0.75rem; text-align: left; border: 1px solid #e5e7eb;">Meaning</th>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><span style="color: #10b981;">✅ Accepted</span></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Perfect! All test cases passed</td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><span style="color: #ef4444;">❌ Wrong Answer</span></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Output doesn't match expected</td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><span style="color: #f59e0b;">⏱️ TLE</span></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Time Limit Exceeded - optimize your code</td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><span style="color: #3b82f6;">💾 MLE</span></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Memory Limit Exceeded</td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><span style="color: #8b5cf6;">🐛 Runtime Error</span></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Code crashed during execution</td>
        </tr>
      </table>
    `,
    category: "problems",
    tags: ["submission", "code", "testing", "verdict"],
    order: 1,
    isPublished: true,
  },
  {
    title: "Understanding Problem Difficulty",
    slug: "problem-difficulty",
    content: `
      <h2>Difficulty Levels Explained</h2>
    
      <div style="margin: 2rem 0;">
        <div style="padding: 1.5rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.75rem; margin-bottom: 1.5rem; color: white;">
          <h3 style="margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
            🟢 Easy Problems
          </h3>
          <p><strong>Perfect for:</strong> Beginners, warming up, learning basics</p>
          <p><strong>Topics:</strong> Arrays, strings, basic loops, simple math</p>
          <p><strong>Time to solve:</strong> 10-20 minutes</p>
          <p><strong>Success rate:</strong> 60-80%</p>
        </div>
      
        <div style="padding: 1.5rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.75rem; margin-bottom: 1.5rem; color: white;">
          <h3 style="margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
            🟡 Medium Problems
          </h3>
          <p><strong>Perfect for:</strong> Intermediate coders, preparing for interviews</p>
          <p><strong>Topics:</strong> Hash maps, trees, graphs, dynamic programming basics</p>
          <p><strong>Time to solve:</strong> 30-45 minutes</p>
          <p><strong>Success rate:</strong> 30-50%</p>
        </div>
      
        <div style="padding: 1.5rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.75rem; color: white;">
          <h3 style="margin-top: 0; display: flex; align-items: center; gap: 0.5rem;">
            🔴 Hard Problems
          </h3>
          <p><strong>Perfect for:</strong> Advanced coders, competitive programming</p>
          <p><strong>Topics:</strong> Advanced DP, complex graphs, segment trees, number theory</p>
          <p><strong>Time to solve:</strong> 1-2 hours</p>
          <p><strong>Success rate:</strong> 10-25%</p>
        </div>
      </div>
    
      <h3>📚 Recommended Learning Path</h3>
      <ol>
        <li><strong>Week 1-2:</strong> Solve 20 Easy problems</li>
        <li><strong>Week 3-4:</strong> Mix of Easy (70%) and Medium (30%)</li>
        <li><strong>Week 5-8:</strong> Mostly Medium with occasional Easy</li>
        <li><strong>Week 9+:</strong> Medium (80%) and Hard (20%)</li>
      </ol>
    `,
    category: "problems",
    tags: ["difficulty", "levels", "learning", "beginner"],
    order: 2,
    isPublished: true,
  },
  // Contests
  {
    title: "Contest Rules and Scoring",
    slug: "contest-rules",
    content: `
      <h2>How Contests Work</h2>
    
      <h3>Contest Format</h3>
      <ul>
        <li><strong>Duration:</strong> 2-3 hours</li>
        <li><strong>Problems:</strong> 4-6 problems (Easy to Hard)</li>
        <li><strong>Attempts:</strong> Unlimited submissions</li>
        <li><strong>Languages:</strong> All supported languages allowed</li>
      </ul>
    
      <h3>Scoring System</h3>
      <p>Your score depends on:</p>
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1.5rem; border-radius: 0.75rem; color: white; margin: 1rem 0;">
        <p><strong>Base Points:</strong> Each problem has a point value (500-3000)</p>
        <p><strong>Time Penalty:</strong> Points decrease over time</p>
        <p><strong>Wrong Submissions:</strong> -50 points per wrong attempt</p>
        <p><strong>Final Score = Base Points - Time Penalty - Wrong Submission Penalties</strong></p>
      </div>
    
      <h3>Contest Types</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1.5rem 0;">
        <tr style="background: #f3f4f6;">
          <th style="padding: 0.75rem; text-align: left; border: 1px solid #e5e7eb;">Type</th>
          <th style="padding: 0.75rem; text-align: left; border: 1px solid #e5e7eb;">Description</th>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><strong>Rated Contest</strong></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Affects your global rating</td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><strong>Practice Contest</strong></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Unrated, for practice only</td>
        </tr>
        <tr>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;"><strong>Virtual Contest</strong></td>
          <td style="padding: 0.75rem; border: 1px solid #e5e7eb;">Participate in past contests</td>
        </tr>
      </table>
    
      <h3>Pro Tips for Success</h3>
      <ol>
        <li>📖 <strong>Read all problems first</strong> - Understand difficulty distribution</li>
        <li>🎯 <strong>Start with easiest</strong> - Build momentum and confidence</li>
        <li>⏰ <strong>Time management</strong> - Don't get stuck on one problem</li>
        <li>✅ <strong>Test thoroughly</strong> - Avoid penalty from wrong submissions</li>
        <li>💪 <strong>Stay calm</strong> - Stress hurts performance</li>
      </ol>
    `,
    category: "contests",
    tags: ["contest", "rules", "scoring", "rating"],
    order: 1,
    isPublished: true,
  },
  // POTD - Updated: changed 7 days → 30 days as first milestone
  {
    title: "Problem of the Day Guide",
    slug: "potd-guide",
    content: `
      <h2>Daily Coding Practice 📅</h2>
      <p>Problem of the Day (POTD) helps you build a consistent coding habit by solving one curated problem every day.</p>
      <p>Each problem is selected to strengthen problem-solving skills across data structures and algorithms.</p>
    
      <h3>Why Solve POTD?</h3>
      <ul>
        <li>🎯 <strong>Consistency</strong><br/>Daily practice improves long-term problem-solving ability.</li>
        <li>🔥 <strong>Streaks & Motivation</strong><br/>Solving POTD daily helps maintain your streak and stay motivated.</li>
        <li>📚 <strong>Concept Coverage</strong><br/>Problems rotate across arrays, strings, trees, graphs, DP, and more.</li>
        <li>⚡ <strong>Time Efficient</strong><br/>Designed to be solved in 15–30 minutes.</li>
      </ul>
    
      <h3>Streak Milestones</h3>
      <div style="display: grid; gap: 1rem; margin: 2rem 0;">
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; color: white;">
          <h4 style="margin: 0;">🥉 30 Days</h4>
          <p style="margin: 0.5rem 0 0 0;">Build your first habit.</p>
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; color: white;">
          <h4 style="margin: 0;">🥈 100 Days</h4>
          <p style="margin: 0.5rem 0 0 0;">Strong consistency and discipline.</p>
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; color: white;">
          <h4 style="margin: 0;">🥇 365 Days</h4>
          <p style="margin: 0.5rem 0 0 0;">Serious dedication to problem-solving.</p>
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.5rem; color: white;">
          <h4 style="margin: 0;">💎 Legendary</h4>
          <p style="margin: 0.5rem 0 0 0;">Elite consistency — achieved by only a small percentage of users.</p>
        </div>
      </div>
    
      <h3>Tips to Maintain Your Streak</h3>
      <ol>
        <li>⏰ Set a daily reminder</li>
        <li>📱 Solve on mobile if you’re away from your system</li>
        <li>🌙 New problem unlocks at midnight (local time)</li>
        <li>💾 Avoid last-minute submissions</li>
      </ol>
    
      <div style="background: #fef3c7; padding: 1.5rem; border-radius: 0.75rem; margin: 1.5rem 0;">
        <p style="margin: 0;"><strong>Note:</strong> Streak Freeze feature will be available soon.</p>
      </div>
    `,
    category: "potd",
    tags: ["daily", "streak", "practice", "potd"],
    order: 1,
    isPublished: true,
  },
  // Profile
  {
    title: "Customize Your Profile",
    slug: "customize-profile",
    content: `
      <h2>Make Your Profile Stand Out</h2>
    
      <h3>Profile Sections</h3>
    
      <div style="margin: 2rem 0;">
        <div style="padding: 1.5rem; background: #f9fafb; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 4px solid #6366f1;">
          <h4 style="margin-top: 0;">👤 Basic Information</h4>
          <ul>
            <li>Display name</li>
            <li>Profile picture</li>
            <li>Bio (200 characters)</li>
            <li>Location</li>
          </ul>
        </div>
      
        <div style="padding: 1.5rem; background: #f9fafb; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 4px solid #10b981;">
          <h4 style="margin-top: 0;">💻 Skills & Interests</h4>
          <ul>
            <li>Favorite programming languages</li>
            <li>Preferred problem topics</li>
            <li>Career goals</li>
          </ul>
        </div>
      
        <div style="padding: 1.5rem; background: #f9fafb; border-radius: 0.75rem; margin-bottom: 1rem; border-left: 4px solid #8b5cf6;">
          <h4 style="margin-top: 0;">🔗 Social Links</h4>
          <ul>
            <li>GitHub profile</li>
            <li>LinkedIn</li>
            <li>Personal website</li>
            <li>Twitter/X</li>
          </ul>
        </div>
      </div>
    
      <h3>Your Stats Dashboard</h3>
      <p>Your profile automatically displays:</p>
      <ul>
        <li>📊 Total problems solved (by difficulty)</li>
        <li>🏆 Contest rating and rank</li>
        <li>🔥 Current and longest streak</li>
        <li>🎖️ Badges and achievements</li>
        <li>📈 Activity heatmap</li>
        <li>⭐ Skills radar chart</li>
      </ul>
    
      <h3>Privacy Settings</h3>
      <p>Control your visibility:</p>
      <ul>
        <li>✅ Public profile (visible to all)</li>
        <li>🔒 Private profile (only you can see)</li>
        <li>👥 Friends only</li>
        <li>📧 Hide email address</li>
        <li>📝 Hide submission history</li>
      </ul>
    `,
    category: "profile",
    tags: ["profile", "customization", "settings", "privacy"],
    order: 1,
    isPublished: true,
  },
  // FAQ - Exact content as per your request
  {
    title: "Frequently Asked Questions",
    slug: "faq",
    content: `
      <h2>Common Questions Answered</h2>
    
      <h3>💰 Pricing and Access</h3>
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: Is KodeKalki free to use?</strong></p>
        <p>A: Yes, KodeKalki is completely free for all core features. Additional advanced features may be introduced later as optional add-ons.</p>
      </div>
    
      <h3>💻 Technical Questions</h3>
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: Which programming languages are supported?</strong></p>
        <p>A: KodeKalki supports Python, Java, C++, JavaScript, C, Go, Rust, and TypeScript. Support for additional languages may be added in the future.</p>
      </div>
    
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: Are external libraries allowed?</strong></p>
        <p>A: Only standard libraries are allowed. External or third-party libraries are not permitted in contests but may be allowed during practice.</p>
      </div>
    
      <h3>📊 Ratings and Progress</h3>
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: How is the user rating calculated?</strong></p>
        <p>A: Ratings are calculated using an ELO-based rating system. Performance is evaluated relative to other participants in the contest.</p>
      </div>
    
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: What happens if a streak is broken?</strong></p>
        <p>A: The streak count resets to zero. Previously earned badges remain unaffected.</p>
      </div>
    
      <h3>🏆 Contests</h3>
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: Can users participate in past contests?</strong></p>
        <p>A: Yes, users can participate in past contests using the Virtual Contest feature. Virtual contests do not impact the user’s rating.</p>
      </div>
    
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: What if a user misses a contest?</strong></p>
        <p>A: Missing a contest does not affect the account. Weekly contests are conducted regularly, and virtual participation is always available.</p>
      </div>
    
      <h3>🔐 Account and Security</h3>
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: How can a user reset their password?</strong></p>
        <p>A: Click on the “Forgot Password” option on the login page and follow the instructions sent to the registered email address.</p>
      </div>
    
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: Can the username be changed?</strong></p>
        <p>A: Yes, a username can be changed once every 30 days through Settings → Profile.</p>
      </div>
    
      <h3>📱 Mobile and Accessibility</h3>
      <div style="background: linear-gradient(135deg, #517878 0%, #6366f1 100%); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; color: white;">
        <p><strong>Q: Is there a mobile application available?</strong></p>
        <p>A: Currently, KodeKalki is fully responsive on mobile browsers. Native mobile applications are under development.</p>
      </div>
    `,
    category: "general",
    tags: ["faq", "questions", "help", "common"],
    order: 1,
    isPublished: true,
  },
  {
    title: "Contact Support",
    slug: "contact-support",
    content: `
      <h2>Get Help When You Need It</h2>
    
      <p>Can't find what you're looking for? We're here to help!</p>
    
      <div style="display: grid; gap: 1.5rem; margin: 2rem 0;">
        <div style="padding: 1.5rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.75rem; color: white;">
          <h3 style="margin-top: 0; color: white;">📧 Email Support</h3>
          <p><a href="mailto:support@kodekalki.com" style="color: white; text-decoration: underline;">support@kodekalki.com</a></p>
          <p style="margin-bottom: 0;">Response time: Within 24 hours</p>
        </div>
      
        <div style="padding: 1.5rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.75rem; color: white;">
          <h3 style="margin-top: 0; color: white;">🐛 Report a Bug</h3>
          <p><a href="mailto:bugs@kodekalki.com" style="color: white; text-decoration: underline;">bugs@kodekalki.com</a></p>
          <p style="margin-bottom: 0;">Help us improve by reporting issues!</p>
        </div>
      
        <div style="padding: 1.5rem; background: linear-gradient(135deg, #517878 0%, #6366f1 100%); border-radius: 0.75rem; color: white;">
          <h3 style="margin-top: 0; color: white;">💡 Feature Request</h3>
          <p><a href="mailto:feedback@kodekalki.com" style="color: white; text-decoration: underline;">feedback@kodekalki.com</a></p>
          <p style="margin-bottom: 0;">Share your ideas with us!</p>
        </div>
      </div>
    
      <h3>When Reporting Bugs, Include:</h3>
      <ul>
        <li>📝 Detailed description of the issue</li>
        <li>🔄 Steps to reproduce the problem</li>
        <li>💻 Browser and operating system</li>
        <li>📸 Screenshots (if applicable)</li>
        <li>⏰ When the issue occurred</li>
      </ul>
    `,
    category: "general",
    tags: ["support", "contact", "bug", "feedback"],
    order: 2,
    isPublished: true,
  },
];

async function seedHelp() {
  try {
    console.log("\n============================================");
    console.log(" 🌱 Seeding Kodekalki Help Center Articles (Interview section removed, POTD 7-day → 30-day)");
    console.log("============================================\n");

    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    console.log("🧹 Clearing existing help articles...");
    const deleted = await Help.deleteMany({});
    console.log(` → Removed ${deleted.deletedCount || 0} old articles\n`);

    console.log("📥 Inserting updated articles...");
    const inserted = await Help.insertMany(sampleArticles);
    console.log(`✅ Successfully inserted ${inserted.length} help articles!\n`);

    console.log("🌐 Available Help URLs:\n");
    inserted.forEach((article, index) => {
      console.log(` ${index + 1}. /help/${article.slug} → ${article.title}`);
    });

    console.log("\n🎉 Seed complete! AI Interview section removed. First POTD milestone is now 30 days.\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding failed:\n");
    console.error(error);
    console.log(
      "\nTip: Check your MONGODB_URI in .env and make sure MongoDB is running.\n"
    );
    process.exit(1);
  }
}

seedHelp();