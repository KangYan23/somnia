// Alternative: Query events instead of getByKey
async function findRegistrationByEvent(phoneHash) {
  // Query UserRegistrationBroadcast events for this phoneHash
  const events = await sdk.streams.getEventsByTopic(
    'UserRegistrationBroadcast',
    { phoneHash } // Filter by phoneHash
  );
  
  if (events && events.length > 0) {
    // Extract wallet address from event data
    const eventData = events[0].data;
    // Decode event data to get wallet address
    return decodeEventData(eventData);
  }
  
  return null;
}