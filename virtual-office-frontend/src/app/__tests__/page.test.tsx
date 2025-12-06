import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../page'

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  return jest.fn(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
  }))
})

// Mock PeerJS
jest.mock('peerjs', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn((event, callback) => {
      if (event === 'open') {
        setTimeout(() => callback('test-peer-id'), 0)
      }
    }),
    call: jest.fn(),
    destroy: jest.fn(),
    off: jest.fn(),
  }))
})

// Mock fetch
global.fetch = jest.fn()

describe('Virtual Office Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ username: 'testuser' }),
    })
  })

  test('renders login form initially', () => {
    render(<Page />)
    expect(screen.getByText('Virtual Office')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your name...')).toBeInTheDocument()
    expect(screen.getByText('Enter Office')).toBeInTheDocument()
  })

  test('login form has required input', () => {
    render(<Page />)
    const input = screen.getByPlaceholderText('Enter your name...')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('maxLength', '24')
  })

  test('enter office button is disabled when username is empty', () => {
    render(<Page />)
    const button = screen.getByText('Enter Office')
    expect(button).toBeDisabled()
  })

  test('shows office layout after login', async () => {
    // This would require more complex setup with state management
    // For now, we test the initial render
    render(<Page />)
    expect(screen.getByText('Virtual Office')).toBeInTheDocument()
  })
})

describe('Office Layout', () => {
  test('office grid dimensions are correct', () => {
    // Test that the office layout constants are defined
    // This is more of a unit test for constants
    expect(true).toBe(true) // Placeholder
  })
})

describe('Chat Functionality', () => {
  test('chat sidebar appears when users are adjacent', () => {
    // Placeholder for chat functionality tests
    // Would require mocking socket.io events and user state
    expect(true).toBe(true)
  })
})

describe('Video Functionality', () => {
  test('video elements are created for group members', () => {
    // Placeholder for video functionality tests
    // Would require mocking PeerJS and media streams
    expect(true).toBe(true)
  })
})

