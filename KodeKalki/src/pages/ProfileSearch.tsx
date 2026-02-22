import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config/api";
// import Loader from "../../components/Common/Loader";

interface User {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
  skills?: string[];
  bio?: string;
}

const ProfileSearch: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setUsers([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await axios.get(`${API_URL}/profiles/search`, {
        params: { q: searchQuery }
      });
      setUsers(response.data);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleUserClick = (username: string) => {
    navigate(`/profile/${username}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Find Kodekalki Coders
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
           Search Kodekalki Coders by name, skills, or expertise
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Kodekalki Coders..."
              className="w-full px-4 py-3 pl-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searching && (
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {users.length > 0 ? (
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user._id}
                onClick={() => handleUserClick(user.username)}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start gap-4">
                  <img
                    src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`}
                    alt={user.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {user.name}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      @{user.username}
                    </p>
                    {user.bio && (
                      <p className="text-gray-700 dark:text-gray-300 text-sm mb-3 line-clamp-2">
                        {user.bio}
                      </p>
                    )}
                    {user.skills && user.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {user.skills.slice(0, 5).map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                          >
                            {skill}
                          </span>
                        ))}
                        {user.skills.length > 5 && (
                          <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                            +{user.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <svg
                    className="w-6 h-6 text-gray-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        ) : searchQuery.trim() && !searching ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">
              No users found matching "{searchQuery}"
            </p>
          </div>
        ) : null}

        {!searchQuery.trim() && users.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto w-16 h-16 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400">
              Looking for a Kalki coder? Start typing...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSearch;