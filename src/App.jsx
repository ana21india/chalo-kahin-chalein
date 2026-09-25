import React from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import CreateTripPage from './pages/CreateTripPage'
import TripEntryPage from './pages/TripEntryPage'
import JoinTripPage from './pages/JoinTripPage'
import PreferenceFlowPage from './pages/PreferenceFlowPage'
import ViewPreferencesPage from './pages/ViewPreferencesPage'
import ParticipantStatusPage from './pages/ParticipantStatusPage'
import CoordinatorDashboardPage from './pages/CoordinatorDashboardPage'
import ResultsPage from './pages/ResultsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<CreateTripPage />} />
      <Route path="/trip/:tripId" element={<TripEntryPage />} />
      <Route path="/trip/:tripId/join" element={<JoinTripPage />} />
      <Route path="/trip/:tripId/preferences" element={<PreferenceFlowPage />} />
      <Route path="/trip/:tripId/preferences/view" element={<ViewPreferencesPage />} />
      <Route path="/trip/:tripId/status" element={<ParticipantStatusPage />} />
      <Route path="/trip/:tripId/dashboard" element={<CoordinatorDashboardPage />} />
      <Route path="/trip/:tripId/results" element={<ResultsPage />} />
    </Routes>
  )
}
