const req = require('request'); exports.handler = function (request, context) {
	req({
		url: process.env['URL'],
		qs: { token: process.env['TOKEN'] },
		body: request,
		json: true
	}, (err, res, body) => {
		if (err)
			context.succeed({ error: err });
		else
			context.succeed(body);
	});
};
