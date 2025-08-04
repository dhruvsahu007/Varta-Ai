import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { analyzeTone, generateReply, queryOrgMemory, generateMeetingNotes } from '../../server/ai';
import type { 
  ToneAnalysis, 
  ReplyGeneration, 
  OrgMemoryQuery, 
  MeetingNotesGeneration 
} from '../../server/ai';

// Get the mock from the global setup
import OpenAI from 'openai';
const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>;

describe('AI Module', () => {
  let mockCreate: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Get the mock instance
    const mockInstance = new mockOpenAI();
    mockCreate = mockInstance.chat.completions.create as jest.MockedFunction<any>;
  });

  describe('analyzeTone', () => {
    test('should analyze tone successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              tone: 'professional',
              impact: 'high',
              clarity: 'clear',
              confidence: 85,
              suggestions: ['Consider being more direct'],
              suggestedTones: ['friendly', 'casual'],
              explanation: 'The message is clear but could be more engaging'
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await analyzeTone('Hello team, please review this document.');
      
      expect(result).toEqual({
        tone: 'professional',
        impact: 'high',
        clarity: 'clear',
        confidence: 85,
        suggestions: ['Consider being more direct'],
        suggestedTones: ['friendly', 'casual'],
        explanation: 'The message is clear but could be more engaging'
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ 
            role: 'user', 
            content: 'Analyze this message: "Hello team, please review this document."' 
          })
        ])
      });
    });

    test('should handle analysis errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));

      const result = await analyzeTone('Test message');
      
      expect(result).toEqual({
        tone: 'neutral',
        impact: 'medium',
        clarity: 'clear',
        confidence: 0,
        suggestions: [],
        suggestedTones: [],
        explanation: ''
      });
    });

    test('should handle invalid JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'invalid json' }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await analyzeTone('Test message');
      
      expect(result.tone).toBe('neutral');
      expect(result.confidence).toBe(0);
    });
  });

  describe('generateReply', () => {
    test('should generate single reply successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [{
                suggestedReply: 'Thank you for the update!',
                confidence: 90,
                reasoning: 'Acknowledges the information professionally'
              }]
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateReply(
        'Project update: We completed phase 1',
        ['Previous context message'],
        'Channel: Project Updates',
        false
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toEqual({
        suggestedReply: 'Thank you for the update!',
        confidence: 90,
        reasoning: 'Acknowledges the information professionally'
      });
    });

    test('should generate multiple replies when requested', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [
                {
                  suggestedReply: 'Great work on phase 1!',
                  confidence: 85,
                  reasoning: 'Positive acknowledgment'
                },
                {
                  suggestedReply: 'Thanks for the update. What\'s next?',
                  confidence: 80,
                  reasoning: 'Shows interest in continuation'
                },
                {
                  suggestedReply: 'Congratulations team!',
                  confidence: 75,
                  reasoning: 'Celebratory response'
                }
              ]
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateReply(
        'Project update: We completed phase 1',
        [],
        '',
        true
      );

      expect(result.suggestions).toHaveLength(3);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Generate 3 different message(s)')
            })
          ])
        })
      );
    });

    test('should handle reply generation errors', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'));

      await expect(generateReply('Test', [], '', false))
        .rejects.toThrow('Network error');
    });

    test('should validate confidence values', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              suggestions: [{
                suggestedReply: 'Test reply',
                confidence: 150, // Invalid: > 100
                reasoning: 'Test reasoning'
              }]
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await generateReply('Test', [], '', false);
      
      // Should clamp confidence to valid range
      expect(result.suggestions[0].confidence).toBe(100);
    });
  });

  describe('queryOrgMemory', () => {
    test('should query organizational memory successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              query: 'project status',
              summary: 'Project Alpha is on track with Phase 1 completed',
              sources: [
                {
                  channelName: 'project-alpha',
                  messageCount: 15,
                  lastUpdate: '2025-01-09T10:00:00Z'
                }
              ],
              keyPoints: [
                'Phase 1 completed successfully',
                'Team is ahead of schedule',
                'Budget is within limits'
              ]
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const mockMessages = [
        {
          content: 'Phase 1 is complete',
          channelName: 'project-alpha',
          authorName: 'John Doe',
          timestamp: '2025-01-09T10:00:00Z'
        }
      ];

      const result = await queryOrgMemory('project status', mockMessages);

      expect(result).toEqual({
        query: 'project status',
        summary: 'Project Alpha is on track with Phase 1 completed',
        sources: [{
          channelName: 'project-alpha',
          messageCount: 15,
          lastUpdate: '2025-01-09T10:00:00Z'
        }],
        keyPoints: [
          'Phase 1 completed successfully',
          'Team is ahead of schedule',
          'Budget is within limits'
        ]
      });
    });

    test('should handle empty message context', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              query: 'test query',
              summary: 'No relevant information found',
              sources: [],
              keyPoints: []
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await queryOrgMemory('test query', []);

      expect(result.sources).toEqual([]);
      expect(result.keyPoints).toEqual([]);
    });
  });

  describe('generateMeetingNotes', () => {
    test('should generate meeting notes successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Weekly Team Standup - January 9, 2025',
              summary: 'Team discussed project progress and upcoming milestones',
              keyPoints: [
                'Phase 1 completed on time',
                'Phase 2 planning started',
                'Resource allocation reviewed'
              ],
              actionItems: [
                'John to prepare Phase 2 timeline',
                'Sarah to review budget allocation',
                'Team to schedule design review'
              ],
              participants: ['John Doe', 'Sarah Smith', 'Mike Johnson'],
              decisions: [
                'Approved Phase 2 timeline',
                'Increased testing budget by 10%'
              ]
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const mockMessages = [
        {
          content: 'Phase 1 is done, let\'s plan Phase 2',
          authorName: 'John Doe',
          timestamp: '2025-01-09T09:00:00Z'
        },
        {
          content: 'I\'ll review the budget requirements',
          authorName: 'Sarah Smith',
          timestamp: '2025-01-09T09:05:00Z'
        }
      ];

      const result = await generateMeetingNotes(mockMessages, 'team-standup');

      expect(result).toEqual({
        title: 'Weekly Team Standup - January 9, 2025',
        summary: 'Team discussed project progress and upcoming milestones',
        keyPoints: [
          'Phase 1 completed on time',
          'Phase 2 planning started',
          'Resource allocation reviewed'
        ],
        actionItems: [
          'John to prepare Phase 2 timeline',
          'Sarah to review budget allocation',
          'Team to schedule design review'
        ],
        participants: ['John Doe', 'Sarah Smith', 'Mike Johnson'],
        decisions: [
          'Approved Phase 2 timeline',
          'Increased testing budget by 10%'
        ]
      });
    });

    test('should handle meeting notes generation errors', async () => {
      mockCreate.mockRejectedValue(new Error('API limit exceeded'));

      const mockMessages = [{
        content: 'Test message',
        authorName: 'Test User',
        timestamp: '2025-01-09T10:00:00Z'
      }];

      await expect(generateMeetingNotes(mockMessages, 'test-channel'))
        .rejects.toThrow('API limit exceeded');
    });

    test('should extract participants from messages', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Test Meeting',
              summary: 'Test summary',
              keyPoints: [],
              actionItems: [],
              participants: ['Alice', 'Bob', 'Charlie'],
              decisions: []
            })
          }
        }]
      };

      mockCreate.mockResolvedValue(mockResponse);

      const mockMessages = [
        { content: 'Hello everyone', authorName: 'Alice', timestamp: '2025-01-09T10:00:00Z' },
        { content: 'Hi Alice', authorName: 'Bob', timestamp: '2025-01-09T10:01:00Z' },
        { content: 'Good morning', authorName: 'Charlie', timestamp: '2025-01-09T10:02:00Z' }
      ];

      const result = await generateMeetingNotes(mockMessages, 'meeting-room');

      expect(result.participants).toContain('Alice');
      expect(result.participants).toContain('Bob');
      expect(result.participants).toContain('Charlie');
    });
  });
});
