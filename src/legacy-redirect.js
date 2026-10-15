// Preserve existing shared links after the turtleSnow address migration.
export default {
  fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = 'turtlesnow.snowcast.workers.dev';
    url.port = '';
    return Response.redirect(url.toString(), 308);
  }
};
