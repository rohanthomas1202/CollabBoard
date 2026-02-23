export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  accentColor: string;
  prompt: string;
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: "swot",
    name: "SWOT Analysis",
    description: "Four-quadrant strategic analysis",
    icon: "S",
    accentColor: "#3b82f6",
    prompt:
      "Create a SWOT analysis template. Make 4 frames in a 2x2 grid starting at position (100, 100) with 50px gaps: Strengths (top-left), Weaknesses (top-right), Opportunities (bottom-left), Threats (bottom-right). Each frame should be 500x400. Inside each frame, add 2 colored sticky notes with placeholder text. Use green notes for Strengths, orange for Weaknesses, blue for Opportunities, pink for Threats.",
  },
  {
    id: "retro",
    name: "Sprint Retro",
    description: "What went well, improve, action items",
    icon: "R",
    accentColor: "#22c55e",
    prompt:
      "Create a sprint retrospective template with 3 frames side by side starting at (100, 100) with 50px gaps. Frame 1: 'What Went Well' with 3 green sticky notes. Frame 2: 'What To Improve' with 3 orange sticky notes. Frame 3: 'Action Items' with 3 blue sticky notes. Each frame should be 420x500. Add placeholder text to each note.",
  },
  {
    id: "journey",
    name: "User Journey Map",
    description: "Map the user experience flow",
    icon: "J",
    accentColor: "#f59e0b",
    prompt:
      "Create a user journey map template. Create 5 frames in a horizontal row starting at (100, 100) with 40px gaps: 'Awareness', 'Consideration', 'Purchase', 'Onboarding', 'Retention'. Each frame 320x450. Add a sticky note in each for 'User Action', 'Touchpoint', and 'Emotion' with placeholder text. Connect the frames with connectors left to right.",
  },
  {
    id: "proscons",
    name: "Pros & Cons",
    description: "Weigh both sides of a decision",
    icon: "P",
    accentColor: "#8b5cf6",
    prompt:
      "Create a Pros and Cons template. Add a text element at (300, 80) that says 'Decision: [Your topic here]' in large text. Below it, make 2 frames side by side starting at (100, 150) with 60px gap: 'Pros' (left, 500x500) and 'Cons' (right, 500x500). Add 3 green sticky notes with placeholder text in the Pros frame and 3 pink sticky notes in the Cons frame.",
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "Free-form idea generation canvas",
    icon: "B",
    accentColor: "#06b6d4",
    prompt:
      "Create a brainstorming template. Make a large central frame titled 'Central Theme' (400x300) at position (400, 300). Around it, create 4 smaller frames: 'Ideas' at (400, 50), 'Questions' at (850, 300), 'Challenges' at (400, 650), 'Resources' at (0, 300). Each outer frame is 350x200. Add 2 placeholder sticky notes in each outer frame with different colors. Connect each outer frame to the central frame with connectors.",
  },
  {
    id: "organize",
    name: "Organize Board",
    description: "Auto-cluster sticky notes into themed groups",
    icon: "O",
    accentColor: "#22c55e",
    prompt:
      "Please organize and cluster all the sticky notes on this board by analyzing their text content. Group similar notes into themed frames, arrange everything neatly, and give each group a descriptive label.",
  },
];
