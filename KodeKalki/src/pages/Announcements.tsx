"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import axios from "axios"
import { Search, Plus, Megaphone, AlertCircle, Info, CheckCircle, Calendar, User, X } from "lucide-react"
import { API_URL } from "../config/api"
import { useTheme } from "../contexts/ThemeContext"
import { showError, showSuccess } from '../utils/toast'

interface Announcement {
  _id: string
  title: string
  content: string
  type: string
  priority: string
  createdAt: string
  createdBy: {
    _id: string
    username: string
  }
  tags?: string[]
  imageUrl?: string
  link?: string
  expiresAt?: string
  pinned?: boolean
  isActive?: boolean
}

const Announcements: React.FC = () => {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState("")
  const [selectedPriority, setSelectedPriority] = useState("")
  const [sortBy, setSortBy] = useState<"recent" | "priority">("recent")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "general",
    priority: "medium",
    tags: "",
    imageUrl: "",
    link: "",
    expiresAt: "",
    pinned: false,
  })
  const { isDark } = useTheme();

  useEffect(() => {
    fetchAnnouncements()
  }, [selectedType, selectedPriority, sortBy])

  const fetchAnnouncements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (selectedType) params.append("type", selectedType)
      if (selectedPriority) params.append("priority", selectedPriority)
      if (sortBy) params.append("sortBy", sortBy)

      const token = localStorage.getItem("token")
      const response = await axios.get(`${API_URL}/announcements?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      
      // Filter out expired announcements
      const currentDate = new Date()
      const activeAnnouncements = response.data.filter((ann: Announcement) => {
        if (!ann.isActive) return false
        if (ann.expiresAt) {
          const expiryDate = new Date(ann.expiresAt)
          return expiryDate > currentDate
        }
        return true
      })
      
      // Sort by pinned first, then priority/recent
      const sortedAnnouncements = activeAnnouncements.sort((a: Announcement, b: Announcement) => {
        // Pinned announcements first
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        
        // Then by sort criteria
        if (sortBy === "priority") {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority as keyof typeof priorityOrder] - 
                 priorityOrder[a.priority as keyof typeof priorityOrder]
        }
        
        // Default: most recent first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      
      setAnnouncements(sortedAnnouncements)
    } catch (error) {
      console.error("Error fetching announcements:", error)
      showError('Error fetching announcements')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || user.role !== "admin") {
      showError('Admin access required')
      return
    }

    try {
      // Prepare tags array
      const tagsArray = newAnnouncement.tags
        .split(",")
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      const announcementData = {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        type: newAnnouncement.type,
        priority: newAnnouncement.priority,
        tags: tagsArray,
        imageUrl: newAnnouncement.imageUrl || undefined,
        link: newAnnouncement.link || undefined,
        expiresAt: newAnnouncement.expiresAt || undefined,
        pinned: newAnnouncement.pinned,
        isActive: true,
      }

      const token = localStorage.getItem("token")
      const response = await axios.post(
        `${API_URL}/announcements`,
        announcementData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )
      
      setAnnouncements([response.data, ...announcements])
      setNewAnnouncement({
        title: "",
        content: "",
        type: "general",
        priority: "medium",
        tags: "",
        imageUrl: "",
        link: "",
        expiresAt: "",
        pinned: false,
      })
      setShowCreateForm(false)
      showSuccess('Announcement created successfully!')
    } catch (error: any) {
      console.error("Error creating announcement:", error)
      showError(error.response?.data?.message || 'Error creating announcement')
    }
  }

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return
    
    try {
      const token = localStorage.getItem("token")
      await axios.delete(`${API_URL}/announcements/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      setAnnouncements(announcements.filter(a => a._id !== id))
      showSuccess('Announcement deleted successfully!')
    } catch (error: any) {
      console.error("Error deleting announcement:", error)
      showError('Error deleting announcement')
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "critical":
      case "high":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "medium":
        return <Info className="h-4 w-4 text-yellow-500" />
      case "low":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-red-500 text-white border-red-600"
      case "high":
        return "bg-red-100 text-red-800 border-red-200"
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "maintenance":
        return <AlertCircle className="h-4 w-4" />
      case "feature":
        return <CheckCircle className="h-4 w-4" />
      case "event":
      case "contest":
        return <Calendar className="h-4 w-4" />
      case "update":
        return <Info className="h-4 w-4" />
      case "alert":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Megaphone className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "contest":
        return "bg-purple-100 text-purple-800"
      case "maintenance":
        return "bg-orange-100 text-orange-800"
      case "feature":
        return "bg-blue-100 text-blue-800"
      case "update":
        return "bg-indigo-100 text-indigo-800"
      case "alert":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const filteredAnnouncements = announcements.filter(
    (announcement) =>
      announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      announcement.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (announcement.tags && announcement.tags.some(tag => 
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      ))
  )

  const allTypes = ["general", "contest", "maintenance", "feature", "update", "alert"]
  const allPriorities = ["critical", "high", "medium", "low"]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Announcements</h1>
            <p className="text-gray-600 dark:text-gray-400">Stay updated with the latest news and updates</p>
          </div>
          {user && user.role === "admin" && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {showCreateForm ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {showCreateForm ? "Cancel" : "New Announcement"}
            </button>
          )}
        </div>

        {showCreateForm && user?.role === "admin" && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Create New Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Announcement title"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Content *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Announcement content (supports Markdown)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type</label>
                  <select
                    value={newAnnouncement.type}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  >
                    <option value="general">General</option>
                    <option value="contest">Contest</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="feature">Feature</option>
                    <option value="update">Update</option>
                    <option value="alert">Alert</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Priority</label>
                  <select
                    value={newAnnouncement.priority}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="urgent, feature, contest"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                    value={newAnnouncement.tags}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, tags: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Image URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                    value={newAnnouncement.imageUrl}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, imageUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Link URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/more-info"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                    value={newAnnouncement.link}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, link: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Expires At</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
                    value={newAnnouncement.expiresAt}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, expiresAt: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newAnnouncement.pinned}
                    onChange={(e) => setNewAnnouncement({ ...newAnnouncement, pinned: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Pin to top</span>
                </label>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Publish Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search announcements..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
          >
            <option value="">All Types</option>
            {allTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
          >
            <option value="">All Priorities</option>
            {allPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "recent" | "priority")}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-md"
          >
            <option value="recent">Most Recent</option>
            <option value="priority">By Priority</option>
          </select>
          <button
            onClick={() => {
              setSelectedType("")
              setSelectedPriority("")
              setSearchTerm("")
              setSortBy("recent")
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>

        {/* Announcements List */}
        <div className="space-y-6">
          {filteredAnnouncements.map((announcement) => (
            <div 
              key={announcement._id} 
              className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow ${
                announcement.pinned ? "border-l-4 border-yellow-500" : ""
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <div className="flex items-center mr-3">
                      {getTypeIcon(announcement.type)}
                      <span className={`ml-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(announcement.type)}`}>
                        {announcement.type.charAt(0).toUpperCase() + announcement.type.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center">
                      {getPriorityIcon(announcement.priority)}
                      <span className={`ml-1 px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(announcement.priority)}`}>
                        {announcement.priority.toUpperCase()}
                      </span>
                    </div>
                    {announcement.pinned && (
                      <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        Pinned
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <h2 className="text-xl font-semibold mb-2">{announcement.title}</h2>
                    <div className="prose dark:prose-invert max-w-none">
                      <p className="text-gray-700 dark:text-gray-300">
                        {announcement.content.length > 300
                          ? `${announcement.content.substring(0, 300)}...`
                          : announcement.content}
                      </p>
                    </div>
                  </div>

                  {announcement.imageUrl && (
                    <div className="mb-4">
                      <img 
                        src={announcement.imageUrl} 
                        alt={announcement.title}
                        className="w-full max-h-64 object-cover rounded-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}

                  {announcement.tags && announcement.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {announcement.tags.map((tag, index) => (
                        <span 
                          key={index} 
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        <span>By {announcement.createdBy?.username || "Unknown"}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      {announcement.link && (
                        <a 
                          href={announcement.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Learn more →
                        </a>
                      )}
                      {user?.role === "admin" && (
                        <button
                          onClick={() => handleDeleteAnnouncement(announcement._id)}
                          className="text-red-600 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAnnouncements.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">
            <Megaphone className="mx-auto h-12 w-12 mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">No announcements found</p>
            <p>Check back later for updates and news.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Announcements