-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trips (a single "Trip Project")
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  coordinator_name TEXT NOT NULL,
  coordinator_id UUID,
  initial_destination TEXT DEFAULT '',
  dates_type TEXT DEFAULT 'flexible' CHECK (dates_type IN ('specific', 'range', 'month', 'flexible')),
  date_start DATE,
  date_end DATE,
  date_month TEXT,
  duration TEXT DEFAULT 'not_decided',
  status TEXT DEFAULT 'collecting' CHECK (status IN ('collecting', 'deciding', 'decided')),
  final_destination TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants (includes the coordinator, flagged)
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_coordinator BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- One response row per participant, upserted as they edit
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE UNIQUE,
  destination_types JSONB DEFAULT '[]',
  destination_no_pref BOOLEAN DEFAULT FALSE,
  activities JSONB DEFAULT '[]',
  activities_no_pref BOOLEAN DEFAULT FALSE,
  vibes JSONB DEFAULT '[]',
  vibes_no_pref BOOLEAN DEFAULT FALSE,
  trip_scope TEXT DEFAULT 'either' CHECK (trip_scope IN ('national', 'international', 'either')),
  specific_destinations JSONB DEFAULT '[]',
  no_specific_destination BOOLEAN DEFAULT FALSE,
  include_coordinator_destination BOOLEAN,
  budget_min INTEGER,
  budget_max INTEGER,
  budget_ceiling INTEGER,
  budget_hard_limit BOOLEAN DEFAULT TRUE,
  budget_includes_flights TEXT DEFAULT 'whole_trip',
  date_range_start DATE,
  date_range_end DATE,
  date_flexibility TEXT DEFAULT 'flexible',
  min_days INTEGER,
  max_days INTEGER,
  starting_city TEXT,
  travel_mode TEXT DEFAULT 'anything',
  travel_time_max TEXT DEFAULT 'no_limit',
  pace TEXT,
  stay_type TEXT,
  room_sharing TEXT,
  dealbreakers JSONB DEFAULT '[]',
  no_dealbreakers BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Final votes, one per participant, upserted
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE UNIQUE,
  option_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participants_trip ON participants(trip_id);
CREATE INDEX IF NOT EXISTS idx_responses_trip ON responses(trip_id);
CREATE INDEX IF NOT EXISTS idx_votes_trip ON votes(trip_id);

-- Row Level Security (permissive — this is an unauthenticated prototype;
-- the trip's UUID invite link is the only access control)
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_trips" ON trips;
CREATE POLICY "allow_all_trips" ON trips FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_participants" ON participants;
CREATE POLICY "allow_all_participants" ON participants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_responses" ON responses;
CREATE POLICY "allow_all_responses" ON responses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_votes" ON votes;
CREATE POLICY "allow_all_votes" ON votes FOR ALL USING (true) WITH CHECK (true);
