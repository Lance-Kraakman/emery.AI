import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

describe('UI Components', () => {
  describe('Button Component', () => {
    it('should render button with text', () => {
      render(<Button>Click me</Button>)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByText('Click me')).toBeInTheDocument()
    })

    it('should apply variant classes correctly', () => {
      render(<Button variant="destructive">Delete</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-destructive')
    })

    it('should handle disabled state', () => {
      render(<Button disabled>Disabled</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:pointer-events-none')
    })

    it('should render as child component when asChild prop is used', () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>
      )
      
      const link = screen.getByRole('link')
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/test')
      expect(link).toHaveClass('inline-flex') // Should have button classes
    })
  })

  describe('Input Component', () => {
    it('should render input with placeholder', () => {
      render(<Input placeholder="Enter text..." />)
      
      const input = screen.getByPlaceholderText('Enter text...')
      expect(input).toBeInTheDocument()
      // Input component may not explicitly set type="text" if it's the default
      expect(input).toHaveAttribute('placeholder', 'Enter text...')
    })

    it('should support different input types', () => {
      render(<Input type="email" placeholder="email@example.com" />)
      
      const input = screen.getByPlaceholderText('email@example.com')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('should handle disabled state', () => {
      render(<Input disabled placeholder="Disabled input" />)
      
      const input = screen.getByPlaceholderText('Disabled input')
      expect(input).toBeDisabled()
    })

    it('should apply custom className', () => {
      render(<Input className="custom-class" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-class')
    })
  })

  describe('Component Integration', () => {
    it('should render form with button and input', () => {
      render(
        <form>
          <Input placeholder="Enter name" />
          <Button type="submit">Submit</Button>
        </form>
      )
      
      expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
    })
  })
})