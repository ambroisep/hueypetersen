module Jekyll
  module DefaultFilter
    def default(input, default)
      input || default
    end
  end
end

Liquid::Template.register_filter(Jekyll::DefaultFilter)