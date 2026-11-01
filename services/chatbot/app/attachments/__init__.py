"""
Attachments in Viva AI chat: lab reports, scan reports, ultrasounds, prescriptions.

A turn with files runs a separate path (app.chains.attachment_turn):
triage (is this a mother/baby health document?) -> policy (decided in code) ->
analysis (only for accepted files) -> deterministic critical-value banner.
Nothing about a refused file's content is ever generated.
"""
