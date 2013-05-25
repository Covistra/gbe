local storyboard = require 'storyboard'
local scene = storyboard.newScene()

-- Setup scene
function scene:createScene( event )

	local page = display.newGroup();
	local background = display.newRect( 0, 0, display.contentWidth, display.contentHeight)
	background.strokeWidth = 0
	background:setFillColor(255, 255, 255)
	background:setStrokeColor(180, 180, 180)
	page:insert(background)

	-- Parse the content and produce a scene struture
	

	local title = display.newText("Bastard Heroe", 50, 50, native.systemFontBold, 48)
	title:setTextColor(0, 0, 0)
	title:setReferencePoint(display.CenterReferencePoint)
	title.x = display.contentWidth * 0.5
	local subtitle = display.newText("by Joel Grenon", 50, 110, native.systemFontBold, 22)
	subtitle:setTextColor(0, 0, 0)
	subtitle:setReferencePoint(display.CenterReferencePoint)
	subtitle.x = display.contentWidth * 0.5
	page:insert(title)

	local text = display.newText([[The last raindrops were still hanging on the lower leaves of the tall tress when you got awaken by the first rays of an hopeful morning sun. You left your home town of {location:Essimbra}, at the heart of the legendary {location:Elven forest}, with an appetite for adventures, to help make the world a better place and leave your name in history's books in a known realms. Equipped with your faithful longbow, your deadly sword and your magic art knowledge, you embark in a 3-day trip to {location:Goshwor}, the closest port, where you'll surely get plenty of proposals to start your adventuring career.]], 25, 175, 
		display.contentWidth - 75, display.contentWidth * 0.75, display.systemFont, 16)
	text:setTextColor(0, 0, 0)
	page:insert(text)

	self.view:insert(page)
end
scene:addEventListener( "createScene" )

-- Cleanup 
function scene:destroyScene( event )
end
scene:addEventListener( "destroyScene" )

return scene
